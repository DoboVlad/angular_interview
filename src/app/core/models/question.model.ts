/** Top-level subject area. Drives the "Angular focus" composition rule. */
export type Category = 'angular' | 'javascript' | 'typescript' | 'web';

/** Fine-grained topic. Used for breakdown reporting and the browse filter. */
export type Subcategory =
  | 'signals'
  | 'forms'
  | 'router'
  | 'cdk'
  | 'performance'
  | 'change-detection'
  | 'di'
  | 'rxjs-interop'
  | 'control-flow'
  | 'testing'
  | 'closures'
  | 'promises'
  | 'typescript-advanced'
  | 'browser-apis'
  | 'security'
  | 'http';

/** 1 = warm-up … 5 = principal. */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type QuestionType = 'multiple-choice' | 'true-false' | 'code-output';

/** Letter key for multiple-choice / code-output answers. */
export type OptionKey = 'A' | 'B' | 'C' | 'D';

/** A correct answer is a letter for MC/code-output, or a boolean for true/false. */
export type AnswerValue = OptionKey | boolean;

export interface Question {
  readonly id: string;
  readonly category: Category;
  readonly subcategory: Subcategory;
  readonly difficulty: Difficulty;
  readonly type: QuestionType;
  /** May contain markdown, including fenced code blocks. */
  readonly question: string;
  /** Present for multiple-choice / code-output (always 4); omitted for true/false. */
  readonly options?: readonly string[];
  readonly correctAnswer: AnswerValue;
  readonly explanation: string;
  readonly seniorInsight: string;
  readonly tags: readonly string[];
}

/** Maps an OptionKey to its array index (A→0 … D→3). */
export const OPTION_KEYS: readonly OptionKey[] = ['A', 'B', 'C', 'D'] as const;

export function optionKeyToIndex(key: OptionKey): number {
  return OPTION_KEYS.indexOf(key);
}

export function indexToOptionKey(index: number): OptionKey {
  const key = OPTION_KEYS[index];
  if (!key) {
    throw new RangeError(`No option key for index ${index}`);
  }
  return key;
}

/** Type guard: a true/false question carries no `options`. */
export function isTrueFalse(q: Question): boolean {
  return q.type === 'true-false';
}
