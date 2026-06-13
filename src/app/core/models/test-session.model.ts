import { AnswerValue, Category, Question } from './question.model';

export type TestSize = 10 | 20 | 40;
export type CategoryFilter = 'angular-focus' | 'js-ts' | 'mixed';
/** Per-question timer in seconds, or `null` for no timer. */
export type TimerSetting = 45 | 90 | null;

export interface TestConfig {
  readonly size: TestSize;
  readonly filter: CategoryFilter;
  readonly timer: TimerSetting;
}

/** A single answered (or skipped) question within a live session. */
export interface AnsweredQuestion {
  readonly question: Question;
  /** The answer the user committed, or `null` when skipped / timed out. */
  readonly given: AnswerValue | null;
  readonly correct: boolean;
  readonly skipped: boolean;
  /** Milliseconds spent on this question. */
  readonly elapsedMs: number;
}

export interface TestSession {
  readonly id: string;
  readonly config: TestConfig;
  readonly questions: readonly Question[];
  readonly startedAt: number;
  /** Index → recorded answer. Sparse until the question is reached. */
  readonly answers: ReadonlyMap<number, AnsweredQuestion>;
}

/** Counts used by the adaptive "level up" nudge. */
export interface AdaptiveState {
  readonly streak: number;
  readonly streakLevel: number;
}

export const CATEGORY_FILTER_LABELS: Record<CategoryFilter, string> = {
  'angular-focus': 'Angular focus (≥75%)',
  'js-ts': 'JavaScript + TypeScript only',
  mixed: 'Mixed bag',
};

/** Categories considered "JS/TS" for the js-ts filter. */
export const JS_TS_CATEGORIES: readonly Category[] = ['javascript', 'typescript'];
