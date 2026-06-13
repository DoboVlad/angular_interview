import { Signal, WritableSignal, computed, signal } from '@angular/core';

/**
 * Lightweight Signal Forms toolkit.
 *
 * This mirrors the shape of Angular 22's built-in Signal Forms
 * (`signalForm()`, `signalControl()`, `withValidators()`) so the app's form
 * code reads idiomatically and stays free of `ReactiveFormsModule`/`FormsModule`.
 * It is a small local implementation (validity, errors, and value are all
 * signals); swap these imports for the framework API when it stabilises with no
 * change to call sites.
 */

export type ValidationErrors = Record<string, unknown>;
export type Validator<T> = (value: T) => ValidationErrors | null;
export type AsyncValidator<T> = (value: T) => Promise<ValidationErrors | null>;

export interface ControlOptions<T> {
  readonly validators?: readonly Validator<T>[];
  readonly asyncValidators?: readonly AsyncValidator<T>[];
}

/** Collects validators (and optional async validators) into control options. */
export function withValidators<T>(
  ...validators: readonly Validator<T>[]
): ControlOptions<T> {
  return { validators };
}

export function withAsyncValidators<T>(
  ...asyncValidators: readonly AsyncValidator<T>[]
): ControlOptions<T> {
  return { asyncValidators };
}

export interface SignalControl<T> {
  readonly value: WritableSignal<T>;
  readonly errors: Signal<ValidationErrors>;
  readonly valid: Signal<boolean>;
  readonly invalid: Signal<boolean>;
  readonly pending: Signal<boolean>;
  readonly touched: Signal<boolean>;
  readonly dirty: Signal<boolean>;
  set(value: T): void;
  markTouched(): void;
  reset(): void;
}

/** Creates a single reactive control whose validity is a signal. */
export function signalControl<T>(
  initial: T,
  options: ControlOptions<T> = {},
): SignalControl<T> {
  const value = signal(initial);
  const touched = signal(false);
  const dirty = signal(false);
  const asyncErrors = signal<ValidationErrors>({});
  const pending = signal(false);

  const syncErrors = computed<ValidationErrors>(() => {
    const current = value();
    const collected: ValidationErrors = {};
    for (const validator of options.validators ?? []) {
      const result = validator(current);
      if (result) Object.assign(collected, result);
    }
    return collected;
  });

  const errors = computed<ValidationErrors>(() => ({
    ...syncErrors(),
    ...asyncErrors(),
  }));

  const valid = computed(() => Object.keys(errors()).length === 0);
  const invalid = computed(() => !valid());

  const runAsync = (next: T): void => {
    const asyncVals = options.asyncValidators ?? [];
    if (asyncVals.length === 0) return;
    pending.set(true);
    Promise.all(asyncVals.map((v) => v(next)))
      .then((results) => {
        const merged: ValidationErrors = {};
        for (const r of results) if (r) Object.assign(merged, r);
        asyncErrors.set(merged);
      })
      .finally(() => pending.set(false));
  };

  return {
    value,
    errors,
    valid,
    invalid,
    pending,
    touched,
    dirty,
    set(next: T) {
      value.set(next);
      dirty.set(true);
      runAsync(next);
    },
    markTouched: () => touched.set(true),
    reset() {
      value.set(initial);
      touched.set(false);
      dirty.set(false);
      asyncErrors.set({});
    },
  };
}

/** A map of controls whose value types are captured in `V`. */
export type Controls<V extends Record<string, unknown>> = {
  [K in keyof V]: SignalControl<V[K]>;
};

export interface SignalForm<V extends Record<string, unknown>> {
  readonly controls: Controls<V>;
  readonly value: Signal<V>;
  /** Group-level (cross-field) errors. */
  readonly errors: Signal<ValidationErrors>;
  readonly valid: Signal<boolean>;
  readonly invalid: Signal<boolean>;
  readonly pending: Signal<boolean>;
  reset(): void;
  markAllTouched(): void;
}

/**
 * Composes controls into a form group, with optional cross-field validators
 * that receive the whole group's value. `V` is inferred from the controls, so
 * call sites keep precise per-field value types.
 */
export function signalForm<V extends Record<string, unknown>>(
  controls: Controls<V>,
  groupValidators: readonly Validator<V>[] = [],
): SignalForm<V> {
  const entries = Object.entries(controls) as [
    keyof V & string,
    SignalControl<unknown>,
  ][];

  const value = computed(() => {
    const out = {} as V;
    for (const [key, control] of entries) {
      out[key] = control.value() as V[typeof key];
    }
    return out;
  });

  const errors = computed<ValidationErrors>(() => {
    const collected: ValidationErrors = {};
    const v = value();
    for (const validator of groupValidators) {
      const result = validator(v);
      if (result) Object.assign(collected, result);
    }
    return collected;
  });

  const valid = computed(
    () =>
      Object.keys(errors()).length === 0 &&
      entries.every(([, c]) => c.valid()),
  );

  return {
    controls,
    value,
    errors,
    valid,
    invalid: computed(() => !valid()),
    pending: computed(() => entries.some(([, c]) => c.pending())),
    reset: () => entries.forEach(([, c]) => c.reset()),
    markAllTouched: () => entries.forEach(([, c]) => c.markTouched()),
  };
}

// ---------------------------------------------------------------------------
// Common validators
// ---------------------------------------------------------------------------

export const Validators = {
  required<T>(value: T): ValidationErrors | null {
    const empty =
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '');
    return empty ? { required: true } : null;
  },

  requiredTrue(value: boolean): ValidationErrors | null {
    return value === true ? null : { required: true };
  },

  minLength(min: number): Validator<string> {
    return (value) =>
      (value ?? '').length >= min ? null : { minLength: { min } };
  },

  pattern(re: RegExp, key = 'pattern'): Validator<string> {
    return (value) => (re.test(value ?? '') ? null : { [key]: true });
  },

  oneOf<T>(allowed: readonly T[]): Validator<T> {
    return (value) => (allowed.includes(value) ? null : { oneOf: true });
  },
};
