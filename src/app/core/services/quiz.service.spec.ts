import { describe, expect, it } from 'vitest';
import {
  composeTest,
  filterPool,
  isCorrect,
  shuffle,
  type Rng,
} from './quiz.service';
import {
  Category,
  Difficulty,
  Question,
  Subcategory,
} from '../models/question.model';
import { TestConfig } from '../models/test-session.model';

// --- Test helpers ----------------------------------------------------------

/** Deterministic LCG so tests are reproducible. */
function seededRng(seed = 42): Rng {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

let id = 0;
function q(
  category: Category,
  subcategory: Subcategory,
  difficulty: Difficulty,
): Question {
  id += 1;
  return {
    id: `q${id}`,
    category,
    subcategory,
    difficulty,
    type: 'true-false',
    question: 'Stub?',
    correctAnswer: true,
    explanation: 'because',
    seniorInsight: 'insight',
    tags: [],
  };
}

/** A bank with enough Angular + JS/TS + web variety to satisfy the rules. */
function makeBank(): Question[] {
  const bank: Question[] = [];
  const subs: Subcategory[] = [
    'signals',
    'change-detection',
    'forms',
    'router',
    'performance',
    'di',
  ];
  for (let d = 1 as Difficulty; d <= 5; d = (d + 1) as Difficulty) {
    for (const s of subs) {
      bank.push(q('angular', s, d));
      bank.push(q('angular', s, d));
    }
    bank.push(q('javascript', 'closures', d));
    bank.push(q('typescript', 'typescript-advanced', d));
    bank.push(q('web', 'browser-apis', d));
  }
  return bank;
}

// --- shuffle ---------------------------------------------------------------

describe('shuffle', () => {
  it('keeps every element (permutation only)', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seededRng());
    expect([...out].sort()).toEqual(input);
  });

  it('does not mutate the input', () => {
    const input = [1, 2, 3];
    shuffle(input, seededRng());
    expect(input).toEqual([1, 2, 3]);
  });

  it('is deterministic for a fixed seed', () => {
    expect(shuffle([1, 2, 3, 4], seededRng(7))).toEqual(
      shuffle([1, 2, 3, 4], seededRng(7)),
    );
  });
});

// --- filterPool ------------------------------------------------------------

describe('filterPool', () => {
  it('keeps only JS/TS for the js-ts filter', () => {
    const pool = filterPool(makeBank(), 'js-ts');
    expect(pool.length).toBeGreaterThan(0);
    expect(
      pool.every((x) => x.category === 'javascript' || x.category === 'typescript'),
    ).toBe(true);
  });

  it('keeps everything for mixed', () => {
    const bank = makeBank();
    expect(filterPool(bank, 'mixed').length).toBe(bank.length);
  });
});

// --- isCorrect -------------------------------------------------------------

describe('isCorrect', () => {
  const tf = q('angular', 'signals', 1);
  it('treats null (skipped) as wrong', () => {
    expect(isCorrect(tf, null)).toBe(false);
  });
  it('matches the correct boolean', () => {
    expect(isCorrect({ ...tf, correctAnswer: true }, true)).toBe(true);
    expect(isCorrect({ ...tf, correctAnswer: true }, false)).toBe(false);
  });
  it('matches the correct option key', () => {
    const mc: Question = {
      ...tf,
      type: 'multiple-choice',
      options: ['a', 'b', 'c', 'd'],
      correctAnswer: 'C',
    };
    expect(isCorrect(mc, 'C')).toBe(true);
    expect(isCorrect(mc, 'A')).toBe(false);
  });
});

// --- composeTest -----------------------------------------------------------

describe('composeTest', () => {
  const rng = () => seededRng(99);

  it('returns the requested size when the pool is large enough', () => {
    const cfg: TestConfig = { size: 20, filter: 'mixed', timer: null };
    expect(composeTest(makeBank(), cfg, rng()).length).toBe(20);
  });

  it('sorts by difficulty ascending', () => {
    const cfg: TestConfig = { size: 40, filter: 'mixed', timer: null };
    const out = composeTest(makeBank(), cfg, rng());
    for (let i = 1; i < out.length; i++) {
      expect(out[i].difficulty).toBeGreaterThanOrEqual(out[i - 1].difficulty);
    }
  });

  it('enforces ≥75% angular for the angular-focus filter', () => {
    const cfg: TestConfig = { size: 20, filter: 'angular-focus', timer: null };
    const out = composeTest(makeBank(), cfg, rng());
    const angular = out.filter((x) => x.category === 'angular').length;
    expect(angular / out.length).toBeGreaterThanOrEqual(0.75);
  });

  it('always includes signals, change-detection and forms when Angular is included', () => {
    const cfg: TestConfig = { size: 10, filter: 'angular-focus', timer: null };
    const out = composeTest(makeBank(), cfg, rng());
    const subs = new Set(out.map((x) => x.subcategory));
    expect(subs.has('signals')).toBe(true);
    expect(subs.has('change-detection')).toBe(true);
    expect(subs.has('forms')).toBe(true);
  });

  it('produces only JS/TS questions for the js-ts filter', () => {
    const cfg: TestConfig = { size: 8, filter: 'js-ts', timer: null };
    const out = composeTest(makeBank(), cfg, rng());
    expect(
      out.every((x) => x.category === 'javascript' || x.category === 'typescript'),
    ).toBe(true);
  });

  it('never repeats a question', () => {
    const cfg: TestConfig = { size: 40, filter: 'mixed', timer: null };
    const out = composeTest(makeBank(), cfg, rng());
    expect(new Set(out.map((x) => x.id)).size).toBe(out.length);
  });
});
