import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule, X, Check, ArrowRight } from 'lucide-angular';
import { AnswerValue, Question } from '../../core/models/question.model';
import { QuizService } from '../../core/services/quiz.service';
import { QuestionCardComponent } from './components/question-card/question-card';
import { TimerRingComponent } from './components/timer-ring/timer-ring';
import { ProgressBarComponent } from '../../shared/components/progress-bar/progress-bar';

@Component({
  selector: 'be-test',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    QuestionCardComponent,
    TimerRingComponent,
    ProgressBarComponent,
  ],
  templateUrl: './test.html',
  styleUrl: './test.scss',
  host: {
    '(document:keydown)': 'onKey($event)',
  },
})
export class Test {
  private readonly quiz = inject(QuizService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly current = this.quiz.current;
  protected readonly currentIndex = this.quiz.currentIndex;
  protected readonly total = this.quiz.total;
  protected readonly answered = this.quiz.currentAnswer;
  protected readonly isAnswered = this.quiz.isAnswered;
  protected readonly isLast = this.quiz.isLastQuestion;
  protected readonly config = this.quiz.activeConfig;

  /** Selected (not yet committed) answer — resets to null on each new question. */
  protected readonly selected = linkedSignal<number, AnswerValue | null>({
    source: () => this.currentIndex(),
    computation: () => null,
  });

  protected readonly showQuit = signal(false);
  protected readonly remaining = signal<number>(0);

  protected readonly progressPct = computed(() =>
    this.total() === 0 ? 0 : ((this.currentIndex() + 1) / this.total()) * 100,
  );
  protected readonly hasTimer = computed(() => this.config()?.timer != null);
  protected readonly canConfirm = computed(
    () => !this.isAnswered() && this.selected() !== null,
  );

  private questionStartMs = Date.now();
  private timerId: ReturnType<typeof setInterval> | null = null;

  protected readonly X = X;
  protected readonly Check = Check;
  protected readonly ArrowRight = ArrowRight;

  constructor() {
    // No session? Bounce to the dashboard.
    if (!this.quiz.hasActiveSession()) {
      void this.router.navigate(['/']);
    }

    // Reset per-question state + (re)start the timer whenever the question changes.
    effect(() => {
      this.currentIndex();
      untracked(() => {
        this.questionStartMs = Date.now();
        this.startTimer();
      });
    });

    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  private elapsed(): number {
    return Date.now() - this.questionStartMs;
  }

  // --- Timer ---------------------------------------------------------------
  private startTimer(): void {
    this.clearTimer();
    const seconds = this.config()?.timer;
    if (seconds == null) return;
    this.remaining.set(seconds);
    this.timerId = setInterval(() => {
      this.remaining.update((r) => r - 1);
      if (this.remaining() <= 0) {
        this.clearTimer();
        this.onTimeout();
      }
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private onTimeout(): void {
    if (!this.isAnswered()) {
      this.quiz.skip(this.elapsed());
    }
    // Brief pause so the user registers the timeout, then advance.
    setTimeout(() => this.advance(), 900);
  }

  // --- Interaction ---------------------------------------------------------
  protected pick(value: AnswerValue): void {
    if (this.isAnswered()) return;
    this.selected.set(value);
  }

  protected confirm(): void {
    if (!this.canConfirm()) return;
    this.clearTimer();
    const value = this.selected();
    if (value !== null) this.quiz.answer(value, this.elapsed());
  }

  protected advance(): void {
    if (this.isLast()) {
      this.finish();
    } else {
      this.quiz.next();
    }
  }

  private finish(): void {
    this.clearTimer();
    const result = this.quiz.finish();
    void this.router.navigate(['/results', result.id]);
  }

  protected quit(): void {
    this.clearTimer();
    void this.router.navigate(['/']);
  }

  // --- Keyboard ------------------------------------------------------------
  protected onKey(event: KeyboardEvent): void {
    if (this.showQuit()) return;
    const q = this.current();
    if (!q) return;

    // Number keys select an option (1–4, or 1–2 for true/false).
    if (/^[1-4]$/.test(event.key) && !this.isAnswered()) {
      const idx = Number(event.key) - 1;
      const max = q.type === 'true-false' ? 2 : (q.options?.length ?? 0);
      if (idx < max) {
        event.preventDefault();
        this.pick(this.indexValue(q, idx));
      }
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (this.isAnswered()) this.advance();
      else this.confirm();
      return;
    }

    if (event.key === 'ArrowRight' && this.isAnswered()) {
      event.preventDefault();
      this.advance();
    }
  }

  private indexValue(q: Question | undefined, idx: number): AnswerValue {
    if (!q) return 'A';
    if (q.type === 'true-false') return idx === 0;
    return (['A', 'B', 'C', 'D'] as const)[idx];
  }
}
