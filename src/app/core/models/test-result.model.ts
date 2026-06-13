import { AnswerValue, Subcategory } from './question.model';
import { TestConfig } from './test-session.model';

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/** A flattened, persistable record of one answered question. */
export interface ResultItem {
  readonly questionId: string;
  readonly subcategory: Subcategory;
  readonly difficulty: number;
  readonly given: AnswerValue | null;
  readonly correctAnswer: AnswerValue;
  readonly correct: boolean;
  readonly skipped: boolean;
}

export interface SubcategoryBreakdown {
  readonly subcategory: Subcategory;
  readonly total: number;
  readonly correct: number;
  readonly avgDifficulty: number;
  /** A short coaching line derived from the score. */
  readonly suggestion: string;
}

/** The immutable, persisted outcome of a completed test. */
export interface TestResult {
  readonly id: string;
  readonly config: TestConfig;
  readonly completedAt: number;
  readonly durationMs: number;
  readonly total: number;
  readonly correct: number;
  readonly wrong: number;
  readonly skipped: number;
  /** 0–100, rounded. */
  readonly scorePct: number;
  readonly grade: LetterGrade;
  readonly items: readonly ResultItem[];
  readonly breakdown: readonly SubcategoryBreakdown[];
}

/** Lightweight aggregate shown on the dashboard stats strip. */
export interface AggregateStats {
  readonly testsTaken: number;
  readonly avgScorePct: number;
  readonly bestStreak: number;
  readonly weakestSubcategory: Subcategory | null;
}

export function gradeFor(scorePct: number): LetterGrade {
  if (scorePct >= 90) return 'A';
  if (scorePct >= 80) return 'B';
  if (scorePct >= 70) return 'C';
  if (scorePct >= 60) return 'D';
  return 'F';
}
