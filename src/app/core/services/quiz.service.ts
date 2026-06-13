import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  AnswerValue,
  Difficulty,
  Question,
  Subcategory,
} from '../models/question.model';
import {
  AnsweredQuestion,
  CategoryFilter,
  JS_TS_CATEGORIES,
  TestConfig,
} from '../models/test-session.model';
import {
  AggregateStats,
  ResultItem,
  SubcategoryBreakdown,
  TestResult,
  gradeFor,
} from '../models/test-result.model';
import { environment } from '../../../environments/environment';
import { StorageService } from './storage.service';
import { STORAGE_KEYS } from '../tokens/injection-tokens';
import { ToastService } from '../../shared/components/toast/toast.service';

/** Subcategories that every Angular-inclusive test must contain at least one of. */
const MANDATORY_SUBCATS: readonly Subcategory[] = [
  'signals',
  'change-detection',
  'forms',
];

/** Source of randomness, overridable in tests for determinism. */
export type Rng = () => number;
const defaultRng: Rng = Math.random;

const HISTORY_LIMIT = 25;

// ---------------------------------------------------------------------------
// Pure, framework-free selection helpers (exported for unit testing).
// ---------------------------------------------------------------------------

/** In-place-safe Fisher–Yates returning a new shuffled array. */
export function shuffle<T>(input: readonly T[], rng: Rng = defaultRng): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function filterPool(
  all: readonly Question[],
  filter: CategoryFilter,
): Question[] {
  if (filter === 'js-ts') {
    return all.filter((q) => JS_TS_CATEGORIES.includes(q.category));
  }
  return [...all];
}

function isAngular(q: Question): boolean {
  return q.category === 'angular';
}

/**
 * Composes a test honouring the spec's rules:
 *  - "angular-focus" ⇒ ≥75% angular questions
 *  - every Angular-inclusive test includes ≥1 of signals/change-detection/forms
 *  - result sorted by difficulty ASC, shuffled within each difficulty band
 */
export function composeTest(
  all: readonly Question[],
  config: TestConfig,
  rng: Rng = defaultRng,
): Question[] {
  const pool = shuffle(filterPool(all, config.filter), rng);
  const size = Math.min(config.size, pool.length);
  const includesAngular = config.filter !== 'js-ts';

  const selected = new Map<string, Question>();
  const take = (q: Question | undefined): void => {
    if (q && !selected.has(q.id)) selected.set(q.id, q);
  };

  // 1. Guarantee the mandatory Angular subcategories.
  if (includesAngular) {
    for (const sub of MANDATORY_SUBCATS) {
      if (selected.size >= size) break;
      take(pool.find((q) => q.subcategory === sub && !selected.has(q.id)));
    }
  }

  // 2. Fill the Angular quota for "angular-focus".
  const angularQuota =
    config.filter === 'angular-focus' ? Math.ceil(size * 0.75) : 0;
  for (const q of pool) {
    if (countAngular(selected) >= angularQuota) break;
    if (isAngular(q)) take(q);
  }

  // 3. Fill the remainder, capping non-Angular at 25% for "angular-focus".
  const maxNonAngular =
    config.filter === 'angular-focus' ? Math.floor(size * 0.25) : size;
  for (const q of pool) {
    if (selected.size >= size) break;
    if (selected.has(q.id)) continue;
    const nonAngularCount = selected.size - countAngular(selected);
    if (!isAngular(q) && nonAngularCount >= maxNonAngular) continue;
    take(q);
  }

  // 4. Sort by difficulty ASC; shuffle within each difficulty band.
  const byDifficulty = new Map<Difficulty, Question[]>();
  for (const q of selected.values()) {
    const band = byDifficulty.get(q.difficulty) ?? [];
    band.push(q);
    byDifficulty.set(q.difficulty, band);
  }
  const ordered: Question[] = [];
  for (let level = 1 as Difficulty; level <= 5; level = (level + 1) as Difficulty) {
    const band = byDifficulty.get(level);
    if (band) ordered.push(...shuffle(band, rng));
  }
  return ordered;
}

function countAngular(selected: Map<string, Question>): number {
  let n = 0;
  for (const q of selected.values()) if (isAngular(q)) n++;
  return n;
}

export function isCorrect(q: Question, given: AnswerValue | null): boolean {
  if (given === null) return false;
  return given === q.correctAnswer;
}

function suggestionFor(correct: number, total: number): string {
  const ratio = total === 0 ? 0 : correct / total;
  if (ratio >= 0.85) return 'Strong — keep this sharp.';
  if (ratio >= 0.6) return 'Solid, a few gaps to close.';
  if (ratio >= 0.4) return 'Shaky — worth focused review.';
  return 'Priority area. Drill this next.';
}

// ---------------------------------------------------------------------------
// QuizService — live session state + adaptive logic + persistence.
// ---------------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class QuizService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);

  /** The full question bank, loaded once via rxResource (httpClient/fetch). */
  readonly bank = rxResource<Question[], unknown>({
    stream: () => this.http.get<Question[]>(environment.questionsUrl),
    defaultValue: [],
  });

  // --- Live session state (signals) ----------------------------------------
  private readonly testId = signal<string>('');
  private readonly config = signal<TestConfig | null>(null);
  /** Reorderable live queue — adaptive logic mutates this. */
  private readonly orderedQuestions = signal<readonly Question[]>([]);
  private readonly startedAt = signal<number>(0);
  private readonly answers = signal<ReadonlyMap<number, AnsweredQuestion>>(
    new Map(),
  );

  readonly currentIndex = signal<number>(0);

  // Adaptive nudge tracking.
  private streak = 0;
  private streakLevel = 0;

  // --- Derived (computed) --------------------------------------------------
  readonly questions = computed(() => this.orderedQuestions());
  readonly total = computed(() => this.orderedQuestions().length);

  readonly current = computed<Question | undefined>(
    () => this.orderedQuestions()[this.currentIndex()],
  );

  readonly currentAnswer = computed<AnsweredQuestion | undefined>(() =>
    this.answers().get(this.currentIndex()),
  );

  readonly isAnswered = computed(() => this.currentAnswer() !== undefined);
  readonly isLastQuestion = computed(
    () => this.currentIndex() >= this.total() - 1,
  );
  readonly answeredCount = computed(() => this.answers().size);

  readonly hasActiveSession = computed(() => this.total() > 0);
  readonly activeConfig = computed(() => this.config());
  readonly activeTestId = computed(() => this.testId());

  // --- Lifecycle -----------------------------------------------------------

  /** Begins a fresh test from the loaded bank using `config`. */
  startTest(config: TestConfig): void {
    const ordered = composeTest(this.bank.value() ?? [], config);
    this.beginSession(config, ordered);
  }

  /** Builds a test out of a specific set of questions (e.g. "retry missed"). */
  startWithQuestions(questions: readonly Question[], config: TestConfig): void {
    const byDifficulty = [...questions].sort(
      (a, b) => a.difficulty - b.difficulty,
    );
    this.beginSession(config, byDifficulty);
  }

  private beginSession(config: TestConfig, ordered: readonly Question[]): void {
    this.testId.set(crypto.randomUUID());
    this.config.set(config);
    this.orderedQuestions.set(ordered);
    this.startedAt.set(Date.now());
    this.answers.set(new Map());
    this.currentIndex.set(0);
    this.streak = 0;
    this.streakLevel = 0;
  }

  /** Records the user's answer for the current question. */
  answer(given: AnswerValue, elapsedMs: number): void {
    const q = this.current();
    if (!q || this.isAnswered()) return;

    const correct = isCorrect(q, given);
    this.record(q, { given, correct, skipped: false, elapsedMs });
    this.applyAdaptiveNudge(q.difficulty, correct);
  }

  /** Marks the current question skipped (manual skip or timer expiry). */
  skip(elapsedMs: number): void {
    const q = this.current();
    if (!q || this.isAnswered()) return;
    this.record(q, { given: null, correct: false, skipped: true, elapsedMs });
    this.streak = 0;
  }

  private record(
    q: Question,
    partial: Omit<AnsweredQuestion, 'question'>,
  ): void {
    const next = new Map(this.answers());
    next.set(this.currentIndex(), { question: q, ...partial });
    this.answers.set(next);
  }

  next(): void {
    if (!this.isLastQuestion()) {
      this.currentIndex.update((i) => i + 1);
    }
  }

  previous(): void {
    this.currentIndex.update((i) => Math.max(0, i - 1));
  }

  /**
   * Adaptive nudge: 3 consecutive correct at level N pulls a level-(N+1)
   * question to the front of the remaining queue and fires a "level up" toast.
   */
  private applyAdaptiveNudge(level: Difficulty, correct: boolean): void {
    if (!correct) {
      this.streak = 0;
      this.streakLevel = level;
      return;
    }
    if (level === this.streakLevel) {
      this.streak += 1;
    } else {
      this.streak = 1;
      this.streakLevel = level;
    }

    if (this.streak >= 3 && level < 5) {
      this.streak = 0;
      const targetLevel = (level + 1) as Difficulty;
      this.promoteUpcoming(targetLevel);
      this.toast.levelUp(targetLevel);
    }
  }

  /** Moves up to 3 upcoming questions of `level` toward the front of the queue. */
  private promoteUpcoming(level: Difficulty): void {
    const list = [...this.orderedQuestions()];
    const from = this.currentIndex() + 1;
    let insertAt = from;
    let moved = 0;
    for (let i = from; i < list.length && moved < 3; i++) {
      if (list[i].difficulty === level && i !== insertAt) {
        const [picked] = list.splice(i, 1);
        list.splice(insertAt, 0, picked);
        insertAt += 1;
        moved += 1;
      } else if (list[i].difficulty === level) {
        insertAt += 1;
        moved += 1;
      }
    }
    if (moved > 0) this.orderedQuestions.set(list);
  }

  // --- Finalisation --------------------------------------------------------

  /** Grades the session, persists it to history, and returns the result id. */
  finish(): TestResult {
    const cfg = this.config();
    const questions = this.orderedQuestions();
    const answers = this.answers();

    const items: ResultItem[] = questions.map((q, i) => {
      const a = answers.get(i);
      return {
        questionId: q.id,
        subcategory: q.subcategory,
        difficulty: q.difficulty,
        given: a?.given ?? null,
        correctAnswer: q.correctAnswer,
        correct: a?.correct ?? false,
        skipped: a?.skipped ?? true,
      };
    });

    const correct = items.filter((i) => i.correct).length;
    const skipped = items.filter((i) => i.skipped).length;
    const wrong = items.length - correct - skipped;
    const scorePct = items.length
      ? Math.round((correct / items.length) * 100)
      : 0;

    const result: TestResult = {
      id: this.testId(),
      config: cfg ?? { size: 10, filter: 'mixed', timer: null },
      completedAt: Date.now(),
      durationMs: Date.now() - this.startedAt(),
      total: items.length,
      correct,
      wrong,
      skipped,
      scorePct,
      grade: gradeFor(scorePct),
      items,
      breakdown: this.buildBreakdown(items),
    };

    this.persistResult(result);
    return result;
  }

  private buildBreakdown(items: readonly ResultItem[]): SubcategoryBreakdown[] {
    const groups = new Map<Subcategory, ResultItem[]>();
    for (const item of items) {
      const g = groups.get(item.subcategory) ?? [];
      g.push(item);
      groups.set(item.subcategory, g);
    }
    return [...groups.entries()]
      .map(([subcategory, group]) => {
        const total = group.length;
        const correct = group.filter((i) => i.correct).length;
        const avgDifficulty =
          group.reduce((sum, i) => sum + i.difficulty, 0) / total;
        return {
          subcategory,
          total,
          correct,
          avgDifficulty: Math.round(avgDifficulty * 10) / 10,
          suggestion: suggestionFor(correct, total),
        };
      })
      .sort((a, b) => a.correct / a.total - b.correct / b.total);
  }

  // --- History / stats -----------------------------------------------------

  history(): TestResult[] {
    return this.storage.read<TestResult[]>(STORAGE_KEYS.history, []);
  }

  resultById(id: string): TestResult | undefined {
    return this.history().find((r) => r.id === id);
  }

  private persistResult(result: TestResult): void {
    const next = [result, ...this.history()].slice(0, HISTORY_LIMIT);
    this.storage.write(STORAGE_KEYS.history, next);
  }

  /** Dashboard aggregate across all stored results. */
  aggregateStats(): AggregateStats {
    const all = this.history();
    if (all.length === 0) {
      return {
        testsTaken: 0,
        avgScorePct: 0,
        bestStreak: 0,
        weakestSubcategory: null,
      };
    }

    const avgScorePct = Math.round(
      all.reduce((s, r) => s + r.scorePct, 0) / all.length,
    );

    // Best run of consecutive correct answers across every test's item list.
    let bestStreak = 0;
    for (const r of all) {
      let run = 0;
      for (const item of r.items) {
        run = item.correct ? run + 1 : 0;
        if (run > bestStreak) bestStreak = run;
      }
    }

    // Weakest subcategory = lowest correct ratio across all answered items.
    const agg = new Map<Subcategory, { correct: number; total: number }>();
    for (const r of all) {
      for (const item of r.items) {
        const cur = agg.get(item.subcategory) ?? { correct: 0, total: 0 };
        cur.total += 1;
        if (item.correct) cur.correct += 1;
        agg.set(item.subcategory, cur);
      }
    }
    let weakestSubcategory: Subcategory | null = null;
    let worstRatio = Infinity;
    for (const [sub, { correct, total }] of agg.entries()) {
      const ratio = correct / total;
      if (ratio < worstRatio) {
        worstRatio = ratio;
        weakestSubcategory = sub;
      }
    }

    return { testsTaken: all.length, avgScorePct, bestStreak, weakestSubcategory };
  }

  /** Returns the questions the user missed (wrong or skipped) in a result. */
  missedQuestions(result: TestResult): Question[] {
    const bank = this.bank.value() ?? [];
    const missedIds = new Set(
      result.items.filter((i) => !i.correct).map((i) => i.questionId),
    );
    return bank.filter((q) => missedIds.has(q.id));
  }
}
