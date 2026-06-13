// =============================================================================
// Question-bank generator.
//
// The full bank is authored here as plain objects so we get editor support,
// stable deterministic IDs, and an automatic distribution check. Running it
// emits src/data/questions.json. Re-running is idempotent (IDs are seeded by
// a stable slug, not random), so the committed JSON never churns spuriously.
//
//   node scripts/gen-questions.mjs
// =============================================================================

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Deterministic UUID-v4-shaped id from a stable seed (xmur3 + sfc32).
function uuidFromSeed(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const rng = (() => {
    let a = h >>> 0,
      b = 0x9e3779b9,
      c = 0x243f6a88,
      d = 0xb7e15162;
    return () => {
      a >>>= 0;
      b >>>= 0;
      c >>>= 0;
      d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  })();
  const hex = [];
  for (let i = 0; i < 256; i++) hex.push((i + 0x100).toString(16).slice(1));
  const b = Array.from({ length: 16 }, () => Math.floor(rng() * 256));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant
  return (
    hex[b[0]] + hex[b[1]] + hex[b[2]] + hex[b[3]] + '-' +
    hex[b[4]] + hex[b[5]] + '-' +
    hex[b[6]] + hex[b[7]] + '-' +
    hex[b[8]] + hex[b[9]] + '-' +
    hex[b[10]] + hex[b[11]] + hex[b[12]] + hex[b[13]] + hex[b[14]] + hex[b[15]]
  );
}

let counter = 0;
// q(): terse builder. `a` is the answer; options omitted ⇒ true/false.
function q(category, subcategory, difficulty, type, question, answer, explanation, seniorInsight, tags, options) {
  counter += 1;
  const id = uuidFromSeed(`be-q-${String(counter).padStart(3, '0')}`);
  const base = { id, category, subcategory, difficulty, type, question };
  if (options) base.options = options;
  base.correctAnswer = answer;
  base.explanation = explanation;
  base.seniorInsight = seniorInsight;
  base.tags = tags;
  return base;
}

const QUESTIONS = [
  // ---- Level 1 — warm-up (8) -------------------------------------------------
  q('angular', 'control-flow', 1, 'multiple-choice',
    'In an Angular 22 template you need to conditionally render a block. Which is the idiomatic, framework-recommended approach for a brand-new app?',
    'C',
    'Angular 17+ shipped built-in control flow (`@if`, `@for`, `@switch`) and Angular 22 treats it as the default. It is compiled directly, needs no import, and is faster than the structural-directive equivalents. `*ngIf` still works but is legacy and the CLI can migrate it automatically.',
    'New code should never reach for `*ngIf`; teams standardising on built-in control flow also drop `CommonModule` imports, shrinking bundle and template-type-check surface.',
    ['control-flow', 'if', 'templates'],
    ['Use `*ngIf` with `CommonModule`', 'Use `[hidden]` binding', 'Use the built-in `@if` block', 'Use `ngSwitch` for a single condition']),

  q('angular', 'signals', 1, 'multiple-choice',
    'Given `const count = signal(0);`, how do you read the current value inside a component method?',
    'B',
    'A signal is a getter function: you call it with `count()` to read its value and track it as a dependency in reactive contexts. Assignment uses `count.set(...)` or `count.update(...)`. There is no `.value` property — that is the RxJS `BehaviorSubject` API, which signals deliberately do not mirror.',
    'The call-to-read convention is what lets `computed`/`effect` auto-track dependencies; reaching for a `.value`-style API is the first sign someone is porting Rx habits onto signals.',
    ['signals', 'signal', 'read'],
    ['`count.value`', '`count()`', '`count.get()`', '`count.next()`']),

  q('angular', 'change-detection', 1, 'true-false',
    'In an `OnPush` component, mutating an object\'s property in place (e.g. `this.user.name = "x"`) without reassigning the reference will, on its own, reliably update the bound template.',
    false,
    'OnPush change detection compares input references and only re-checks on new references, events, or async-pipe emissions. Mutating a property in place keeps the same reference, so an input-driven OnPush component will not see it as a change. You must assign a new reference (or use signals, which notify independently of reference identity).',
    'This is the single most common OnPush footgun; migrating that same state to a `signal` sidesteps it entirely because signal reads register a dependency regardless of object identity.',
    ['change-detection', 'onpush', 'immutability']),

  q('angular', 'di', 1, 'multiple-choice',
    'What is the practical advantage of `inject(Router)` in a field initialiser over injecting `Router` through the constructor?',
    'A',
    'The `inject()` function works anywhere an injection context is active, including field initialisers, factory functions, route guards, and base-class helpers, so it composes better than constructor parameters. It also avoids constructor boilerplate and plays well with mixins/inheritance. Both resolve from the same injector tree — the difference is ergonomics and reach, not capability.',
    'Functional guards, resolvers, and `inject()`-based composable helpers all depend on this; once a team adopts `inject()` they can extract reusable logic that would be impossible to share via constructor injection.',
    ['di', 'inject', 'injection-context'],
    ['It can be called from more places (field initialisers, functions, guards)', 'It is the only way to get a singleton', 'It bypasses the injector for speed', 'It makes the dependency optional automatically']),

  q('angular', 'control-flow', 1, 'multiple-choice',
    'Why does Angular 22 require a `track` expression on every `@for` loop?',
    'D',
    '`track` tells Angular how to identify each item across renders so it can move/reuse DOM nodes instead of destroying and recreating them. Without a stable identity, list updates would tear down and rebuild every row, losing focus/state and hurting performance. It is mandatory (a compile-time error if omitted) precisely because getting it wrong is a common, silent performance bug.',
    'Tracking by `$index` on a reorderable list is technically valid but defeats the purpose — pick a stable domain id, or you reintroduce the very re-rendering `track` exists to prevent.',
    ['control-flow', 'for', 'track', 'performance'],
    ['To enable two-way binding', 'To allow nested loops', 'For accessibility labelling', 'To give each item a stable identity for efficient DOM reuse']),

  q('web', 'browser-apis', 1, 'multiple-choice',
    'You call `localStorage.setItem("user", { id: 1 })`. What is actually stored?',
    'B',
    '`localStorage` only stores strings. Passing an object triggers an implicit `String(value)` conversion, which yields the literal `"[object Object]"`. To persist structured data you must `JSON.stringify` on write and `JSON.parse` on read. This is a frequent source of "my saved object came back as a useless string" bugs.',
    'A typed storage wrapper that serialises/deserialises for you removes a whole class of these bugs and is worth the 20 lines in any real app.',
    ['browser-apis', 'localstorage', 'serialization'],
    ['`{ id: 1 }` as a real object', 'The string `"[object Object]"`', '`{"id":1}` as JSON automatically', 'It throws a TypeError']),

  q('web', 'security', 1, 'true-false',
    'A correctly configured `Content-Security-Policy` header that disallows inline scripts is an effective mitigation against many reflected XSS attacks.',
    true,
    'CSP lets the server declare which script sources the browser may execute; blocking inline scripts and untrusted origins prevents injected `<script>` payloads from running even if they reach the DOM. It is defence-in-depth — not a substitute for output encoding/sanitisation, but a strong second layer. Angular\'s own contextual auto-escaping handles the first layer.',
    'CSP and Angular sanitisation are complementary; relying on Angular alone leaves you exposed the moment someone reaches for `bypassSecurityTrustHtml` or `innerHTML`.',
    ['security', 'csp', 'xss']),

  q('javascript', 'closures', 1, 'multiple-choice',
    'After `const fns = []; for (let i = 0; i < 3; i++) { fns.push(() => i); }`, what does `fns.map(f => f())` return?',
    'A',
    '`let` is block-scoped and the loop creates a fresh binding of `i` per iteration, so each closure captures its own value: `[0, 1, 2]`. With `var` (function-scoped, one shared binding) you would instead get `[3, 3, 3]`. This per-iteration binding for `let` in `for` loops is specified behaviour, not a quirk.',
    'This exact difference is why the old IIFE-in-a-loop pattern disappeared with ES6; reviewers should still flag `var` in loops because the shared-binding bug is easy to reintroduce.',
    ['closures', 'let', 'scope'],
    ['`[0, 1, 2]`', '`[3, 3, 3]`', '`[1, 2, 3]`', '`[undefined, undefined, undefined]`']),

  // ---- Level 2 — solid (18) --------------------------------------------------
  q('angular', 'signals', 2, 'multiple-choice',
    'A `computed()` signal in Angular is best described as:',
    'B',
    '`computed` produces a memoised, lazily-evaluated, read-only signal: its body only runs when read after a dependency changed, and the result is cached until then. It cannot be set directly. This laziness means a computed that nobody reads never runs — unlike an `effect`, which is eager.',
    'Because computeds are pull-based and memoised, you can layer many of them cheaply; the perf trap is putting expensive non-pure work (HTTP, DOM reads) inside one instead of in a `resource` or `effect`.',
    ['signals', 'computed', 'memoization'],
    ['An eagerly-recomputed value that runs on every change detection', 'A memoised, lazily-evaluated read-only signal', 'A writable signal with a default transform', 'A subscription that pushes values to subscribers']),

  q('angular', 'signals', 2, 'true-false',
    'An `effect()` created in a component runs at least once after creation, even if you never change any of the signals it reads.',
    true,
    'Effects run an initial time to establish their dependency set, then re-run whenever a tracked dependency changes. The first run is how Angular discovers which signals the effect depends on. Effects are scheduled (they run as part of the framework\'s reactive flush), not synchronously at the line where you declare them.',
    'Relying on an effect for "run once on init" is a smell — it will also re-run on dependency changes; for genuine one-time setup prefer constructor/`afterNextRender` logic.',
    ['signals', 'effect', 'lifecycle']),

  q('angular', 'forms', 2, 'multiple-choice',
    'Using Angular 22 Signal Forms, which API creates a single field control with a synchronous required validator?',
    'C',
    'Signal Forms model controls as signals: `signalControl(initialValue, withValidators(required))` builds a single field whose value, status, and errors are all signals. `signalForm` composes multiple controls into a form group. This replaces `FormControl`/`Validators.required` from `ReactiveFormsModule`, which Signal-Forms apps no longer import.',
    'Because validity is a signal, you bind to `control.errors()` directly in the template with no async pipe and no manual change detection — a big simplification over the observable-based status of reactive forms.',
    ['forms', 'signal-forms', 'validators'],
    ['`new FormControl("", Validators.required)`', '`signalForm({ name: ["", required] })`', '`signalControl("", withValidators(required))`', '`signal("").withValidators(required)`']),

  q('angular', 'change-detection', 2, 'multiple-choice',
    'In a zoneless Angular 22 app, which of these does NOT, by itself, schedule change detection?',
    'D',
    'Zoneless CD is driven by explicit reactive notifications: signal writes that are read in a template, async-pipe emissions, and event bindings all notify the scheduler. A bare `setTimeout` callback that mutates a plain (non-signal) field notifies nothing, so the view will not refresh. Without Zone.js there is no monkey-patching of timers to trigger CD.',
    'This is the core migration risk when going zoneless: any state that drives the UI must be a signal (or flow through the async pipe), or you get silent stale views with no error.',
    ['change-detection', 'zoneless', 'signals'],
    ['A signal read in the template being updated', 'An event binding firing', 'An async pipe emitting', 'A `setTimeout` mutating a plain class field']),

  q('angular', 'di', 2, 'multiple-choice',
    'What does `@Injectable({ providedIn: "root" })` give you that registering the service in a component\'s `providers` array does not?',
    'A',
    '`providedIn: "root"` registers the service with the root injector as a single app-wide singleton and makes it tree-shakable if unused. Listing it in a component\'s `providers` creates a new instance scoped to that component and its children, so you get one instance per component instance. The choice is about lifetime/scope, not whether DI works.',
    'Scoping a service to a component is a deliberate, useful tool (e.g. per-wizard state) — the bug is doing it accidentally and wondering why two parts of the app see different state.',
    ['di', 'providedin', 'singleton'],
    ['A tree-shakable app-wide singleton', 'Faster injection at runtime', 'Automatic `OnPush` change detection', 'Protection from circular dependencies']),

  q('angular', 'control-flow', 2, 'multiple-choice',
    'What is the purpose of the `@empty` block in `@for (item of items; track item.id) { ... } @empty { ... }`?',
    'B',
    'The `@empty` block renders when the tracked collection has zero items, replacing the old `@if (items.length === 0)` companion check. It is part of the built-in `@for` syntax and is evaluated by the same compiled loop, so there is no separate length expression to keep in sync. It only triggers on genuinely empty collections, not on `null`/`undefined` (guard those separately).',
    'Pairing `@for`/`@empty` keeps the empty-state co-located with the list, which is easier to maintain than a sibling `@if` that can drift out of sync as the data shape changes.',
    ['control-flow', 'for', 'empty'],
    ['It runs once before the loop', 'It renders when the collection is empty', 'It clears the list', 'It is the loop\'s error handler']),

  q('angular', 'rxjs-interop', 2, 'multiple-choice',
    'When converting an Observable to a signal with `toSignal(source$)`, why is supplying `{ initialValue }` often important?',
    'C',
    'Without an initial value, `toSignal` types the signal as `T | undefined` and emits `undefined` until the source produces its first value. Providing `initialValue` gives a defined starting value and narrows the type to `T`. For sources that emit synchronously on subscription (like a `BehaviorSubject`) it is less critical, but for async sources it avoids an `undefined` flash and template guards.',
    'The `undefined`-until-first-emission gap is a classic template bug; `initialValue` (or `requireSync: true` for known-synchronous sources) makes the signal\'s type honest about what the template will actually see.',
    ['rxjs-interop', 'tosignal', 'initialvalue'],
    ['It subscribes lazily', 'It prevents memory leaks', 'It avoids an `undefined` first value and narrows the type to `T`', 'It is required or `toSignal` throws']),

  q('angular', 'router', 2, 'true-false',
    'A `routerLink` directive automatically prevents a full-page reload and performs client-side navigation, whereas a plain `href` on an anchor would trigger a full document load.',
    true,
    '`routerLink` intercepts the click, calls the `Router`, and updates the view via the SPA navigation pipeline without reloading the document. A plain `href="/foo"` is a normal browser navigation that re-downloads and re-bootstraps the app. `routerLink` also keeps the URL, history, and active-link state in sync.',
    'Mixing real `href`s with router navigation breaks deep-link state and resets app memory; the only legitimate `href` in an SPA shell is for genuinely external destinations.',
    ['router', 'routerlink', 'navigation']),

  q('angular', 'performance', 2, 'multiple-choice',
    'A `@defer` block with no trigger defaults to which loading behaviour?',
    'A',
    'A `@defer` block with no explicit trigger uses the `idle` trigger by default: it loads the deferred chunk when the browser becomes idle (via `requestIdleCallback`). You can override with triggers like `on viewport`, `on interaction`, `on hover`, or `when <condition>`. The deferred dependencies are split into a separate lazy chunk regardless of trigger.',
    'Defaulting to `idle` is fine for below-the-fold widgets, but for content that is immediately visible `on viewport` is usually the better trigger — idle can fire before the user ever scrolls, negating the savings.',
    ['performance', 'defer', 'lazy'],
    ['Loads when the browser is idle', 'Loads immediately on render', 'Never loads until clicked', 'Loads on the next navigation']),

  q('angular', 'signals', 2, 'multiple-choice',
    'When should you reach for `linkedSignal()` rather than `computed()`?',
    'B',
    '`linkedSignal` produces a *writable* signal whose value is derived from a source but can also be locally overridden, and which resets when the source changes. `computed` is strictly read-only. The canonical use is "selected item that should reset when the list reloads, but can be changed by the user in between".',
    'A `linkedSignal` for the currently-selected answer that resets when the question index changes is exactly the pattern this quiz uses — a `computed` could not hold the user\'s in-progress selection.',
    ['signals', 'linkedsignal', 'derived-state'],
    ['When you need a faster computed', 'When you need derived state that is also locally writable and resets on source change', 'When the value never changes', 'When you need an Observable']),

  q('angular', 'control-flow', 2, 'true-false',
    'The `@let` template syntax in Angular 22 creates a reusable template-local variable that updates when its expression\'s dependencies change.',
    true,
    '`@let name = expression;` declares a local variable usable later in the same template (and nested blocks), and it stays reactive — when the expression\'s dependencies change, the value updates. It removes the old "alias via `*ngIf="x as y"`" hacks. It is read-only within the template and scoped to its declaration site downward.',
    '`@let` is great for naming an expensive expression once, but remember it is recomputed reactively — it is not a one-time snapshot, so it is not a place to "freeze" a value.',
    ['control-flow', 'let', 'templates']),

  q('javascript', 'closures', 2, 'multiple-choice',
    'What does `typeof null` evaluate to in JavaScript, and why?',
    'C',
    '`typeof null` returns `"object"` — a famous, deliberately-preserved bug from the first JavaScript implementation, where values were tagged by type bits and `null` shared the object tag (all-zero pointer). Fixing it would break the web, so it is frozen in the spec. To test for null specifically use `value === null`.',
    'Code that uses `typeof x === "object"` as a null/undefined guard is subtly broken because it accepts `null`; reviewers should push for explicit `=== null` checks.',
    ['closures', 'typeof', 'null'],
    ['`"null"`', '`"undefined"`', '`"object"`', '`"boolean"`']),

  q('javascript', 'promises', 2, 'multiple-choice',
    'Consider:\n```js\nconsole.log("A");\nsetTimeout(() => console.log("B"), 0);\nPromise.resolve().then(() => console.log("C"));\nconsole.log("D");\n```\nWhat is the output order?',
    'B',
    'Synchronous code runs first: `A`, then `D`. The promise callback is a microtask and the `setTimeout` is a macrotask; microtasks drain completely before the next macrotask. So `C` (microtask) runs before `B` (macrotask). Final order: `A D C B`.',
    'This microtask-before-macrotask rule explains why a promise chain can starve `setTimeout` callbacks; in Angular it is also why signal effects (microtask-scheduled) settle before timer-based work.',
    ['promises', 'event-loop', 'microtask'],
    ['`A B C D`', '`A D C B`', '`A D B C`', '`A C D B`']),

  q('typescript', 'typescript-advanced', 2, 'multiple-choice',
    'What is the key difference between the `unknown` and `any` types in TypeScript?',
    'D',
    '`any` opts out of type checking entirely — you can do anything with it, propagating unsafety. `unknown` is the type-safe top type: any value is assignable *to* it, but you cannot use it until you narrow it with a type guard. So `unknown` forces a check before use, preserving safety at the boundary.',
    'Typing third-party/JSON boundaries as `unknown` instead of `any` is a cheap, high-leverage habit — it pushes a narrowing check exactly where the runtime uncertainty actually is.',
    ['typescript-advanced', 'unknown', 'any'],
    ['They are identical', '`unknown` is faster at runtime', '`any` requires narrowing before use', '`unknown` requires narrowing before use; `any` disables checking']),

  q('web', 'browser-apis', 2, 'multiple-choice',
    'Why can reading `element.offsetHeight` immediately after changing an element\'s style cause a performance problem?',
    'A',
    'Reading layout properties like `offsetHeight` forces a synchronous reflow if there are pending style changes, because the browser must recalculate layout to return an accurate value. Doing this repeatedly in a loop (write-read-write-read) causes "layout thrashing". The fix is to batch all reads, then all writes, or use `requestAnimationFrame`.',
    'In Angular this matters in `afterEveryRender`/directives that measure the DOM — interleaving reads and writes across components can thrash layout in ways that are invisible until you profile.',
    ['browser-apis', 'reflow', 'performance'],
    ['It forces a synchronous reflow to return an up-to-date value', 'It is always cached and free', 'It triggers a network request', 'It mutates the element']),

  q('web', 'browser-apis', 2, 'true-false',
    'A debounced search input that waits 300ms after the last keystroke before firing reduces the number of requests compared with firing on every keystroke.',
    true,
    'Debouncing collapses a rapid burst of events into a single trailing invocation after a quiet period, so a 10-character query fires one request instead of ten. It trades a little latency for far fewer calls. Throttling differs — it caps the *rate* but still fires periodically during the burst.',
    'In a signal-based Angular app you can debounce without RxJS by combining a writable signal, an `effect`, and `setTimeout`/`linkedSignal` — but for a single input a computed over a debounced signal is often the cleanest.',
    ['browser-apis', 'debounce', 'performance']),

  q('web', 'http', 2, 'multiple-choice',
    'A browser issues a `POST` with `Content-Type: application/json` to a different origin. What does the browser do first?',
    'B',
    'A JSON `POST` to another origin is not a "simple request", so the browser sends a CORS *preflight* `OPTIONS` request asking whether the actual request is allowed. Only if the server responds with the right `Access-Control-Allow-*` headers does the real `POST` go out. This is why your API must answer `OPTIONS` and echo the allowed methods/headers/origin.',
    'This is exactly why calling the Anthropic API directly from the browser needs correct CORS handling — and why the deploy docs spell out the bucket/endpoint CORS config.',
    ['http', 'cors', 'preflight'],
    ['Sends the POST directly', 'Sends a preflight `OPTIONS` request first', 'Blocks the request unconditionally', 'Downgrades it to a GET']),

  q('angular', 'change-detection', 2, 'multiple-choice',
    'In an `OnPush` component, the `async` pipe is often preferred over manually subscribing and assigning to a field. Beyond unsubscription, what change-detection benefit does it give?',
    'A',
    'The `async` pipe calls `markForCheck()` automatically whenever its source emits, so an `OnPush` view refreshes on new values without any manual `ChangeDetectorRef` wiring. A manual `.subscribe()` that assigns to a field does NOT mark the view dirty under `OnPush`, so the template can show stale data until some other event triggers CD. The pipe also unsubscribes on destroy.',
    'This is the classic "my manual subscription updates the field but the template never changes" OnPush bug; the async pipe (or migrating to signals, which notify intrinsically) is the fix.',
    ['change-detection', 'async-pipe', 'onpush'],
    ['It calls `markForCheck()` on each emission so OnPush views refresh', 'It makes HTTP faster', 'It caches responses', 'It disables OnPush automatically']),

  // ---- Level 3 — senior (35) -------------------------------------------------
  q('angular', 'http', 3, 'multiple-choice',
    'You load data with `resource({ request: () => ({ id: this.userId() }), loader: ({ request }) => fetchUser(request.id) })`. What happens when `this.userId()` changes?',
    'A',
    'The `request` is a reactive computation: when any signal it reads changes, `resource` recomputes the request, aborts any in-flight load, and re-runs the loader with the new request. The resource exposes `value()`, `status()`, `error()`, and `isLoading()` as signals. This is the declarative replacement for manually wiring `switchMap` over a params stream.',
    'Because the previous request is aborted via an `AbortSignal` passed to the loader, you get switchMap-like cancellation for free — but only if your loader actually forwards `abortSignal` to `fetch`.',
    ['http', 'resource', 'reactive-request'],
    ['It aborts the in-flight load and re-runs the loader with the new request', 'Nothing until you call `refresh()`', 'It queues a second loader run after the first finishes', 'It throws because the request changed mid-flight']),

  q('angular', 'forms', 3, 'multiple-choice',
    'In Signal Forms, you need a "passwords must match" rule spanning two fields. Where does that validator belong?',
    'C',
    'A rule that depends on more than one control is a cross-field (group-level) validator, attached to the enclosing `signalForm` group rather than to either individual `signalControl`. It receives the group\'s value and reports errors at the group level (e.g. `form.errors().mismatch`). Attaching it to one field cannot see the other field\'s value cleanly.',
    'Surfacing a group-level error next to the *second* field (while keeping the error on the group) is the usual UX; design your template to read `form.errors()` but render the message where the user expects it.',
    ['forms', 'signal-forms', 'cross-field-validator'],
    ['On the password `signalControl`', 'On the confirm `signalControl`', 'On the enclosing `signalForm` group as a cross-field validator', 'In a component `effect()` that calls `setErrors`']),

  q('angular', 'change-detection', 3, 'multiple-choice',
    'In a zone-based app, what is the difference between `ChangeDetectorRef.markForCheck()` and `detectChanges()`?',
    'B',
    '`markForCheck()` marks the component and its ancestors as dirty so they are checked on the *next* change-detection cycle — it schedules, it does not run synchronously. `detectChanges()` runs change detection synchronously for this view and its children *right now*. Misusing `detectChanges()` inside an existing CD pass can throw `ExpressionChangedAfterChecked` or cause re-entrancy.',
    'Reach for `markForCheck()` 95% of the time; synchronous `detectChanges()` is a scalpel for imperative cases (e.g. measuring DOM after a manual update) and is easy to misuse into double-CD bugs.',
    ['change-detection', 'markforcheck', 'detectchanges'],
    ['They are aliases', '`markForCheck` schedules a check; `detectChanges` runs one synchronously now', '`markForCheck` runs now; `detectChanges` schedules', 'Both only work in OnPush components']),

  q('angular', 'di', 3, 'multiple-choice',
    'What is the idiomatic Angular 22 way to run cleanup logic when an injectable or component is destroyed, without implementing `OnDestroy`?',
    'A',
    'Inject `DestroyRef` and call `destroyRef.onDestroy(callback)`; the callback fires on teardown. This works in services, directives, and functional contexts where there is no lifecycle hook to implement. It also underpins `takeUntilDestroyed()`, which captures the current `DestroyRef` to auto-unsubscribe.',
    'Because `DestroyRef` works outside components, you can build reusable `inject()`-based helpers (e.g. an interval that self-cleans) — something `ngOnDestroy` could never express from a plain function.',
    ['di', 'destroyref', 'cleanup'],
    ['Inject `DestroyRef` and register `onDestroy(cb)`', 'Use `window.addEventListener("unload")`', 'Manually null all fields', 'Throw inside the constructor']),

  q('angular', 'rxjs-interop', 3, 'multiple-choice',
    'A component subscribes to a long-lived Observable. Which is the most robust leak-prevention pattern in Angular 22?',
    'C',
    '`takeUntilDestroyed()` (with no argument, called in an injection context) wires the subscription to the current `DestroyRef` and completes it on teardown automatically. It is less error-prone than a manual `takeUntil(destroy$)` subject you must remember to next/complete. Outside an injection context you pass a `DestroyRef` explicitly.',
    'For UI state, prefer `toSignal` over subscribing at all — but for genuine side effects (analytics, websockets) `takeUntilDestroyed()` is the clean, forget-proof unsubscription story.',
    ['rxjs-interop', 'takeuntildestroyed', 'leaks'],
    ['Manually unsubscribe in `ngOnDestroy`', 'Rely on garbage collection', 'Pipe through `takeUntilDestroyed()`', 'Use `.subscribe()` and never unsubscribe']),

  q('angular', 'performance', 3, 'multiple-choice',
    'When is `NgOptimizedImage` (the `ngSrc` directive) most beneficial, and what does it require?',
    'D',
    '`NgOptimizedImage` enforces best practices for raster images: it sets `loading`/`fetchpriority`, generates `srcset`, warns on layout shift, and requires explicit `width`/`height` (or `fill`) to reserve space. It is for content images, not CSS backgrounds. Forgetting dimensions is a runtime error precisely to prevent CLS.',
    'The biggest real-world win is on the LCP hero image with `priority`; using `ngSrc` everywhere but missing `priority` on the LCP element leaves the main Lighthouse gain on the table.',
    ['performance', 'ngoptimizedimage', 'lcp'],
    ['For SVG icons; requires a loader', 'For CSS backgrounds; requires no config', 'For any image; requires nothing', 'For raster content images; requires explicit width/height (or fill)']),

  q('angular', 'router', 3, 'multiple-choice',
    'How is a functional route guard written in Angular 22?',
    'B',
    'A `CanActivateFn` is a plain function: `(route, state) => boolean | UrlTree | Observable<...> | Promise<...>`, typically using `inject()` to pull dependencies. It replaces the old class-based `CanActivate` guard and is tree-shakable and composable. You can build higher-order guards that return such functions.',
    'Functional guards compose: a `roleGuard("admin")` factory returning a `CanActivateFn` is trivial to test and reuse, whereas the class-based equivalent needed a provider per variant.',
    ['router', 'guards', 'functional'],
    ['A class implementing `CanActivate`', 'A function `(route, state) => ...` using `inject()` for deps', 'A provider object only', 'A decorator on the component']),

  q('angular', 'router', 3, 'true-false',
    'With `withViewTransitions()` enabled, Angular wraps router navigations in the browser\'s View Transitions API so you can animate between routes with pure CSS `::view-transition` rules.',
    true,
    '`provideRouter(routes, withViewTransitions())` makes the router call `document.startViewTransition()` around the DOM swap on navigation, letting you style `::view-transition-old/new(root)` (and named transitions) in CSS. It degrades gracefully where the API is unsupported. No per-component animation metadata is required.',
    'View transitions are cheap to add but can feel janky if a route does heavy synchronous work during the swap — keep the transition boundary light, or the cross-fade stutters.',
    ['router', 'view-transitions', 'animation']),

  q('angular', 'control-flow', 3, 'multiple-choice',
    'A component projects content with `<ng-content select="[card-header]"></ng-content>`. A consumer writes `<my-card><h2>Title</h2></my-card>`. What renders in the header slot?',
    'C',
    '`select="[card-header]"` only matches projected nodes carrying a `card-header` attribute. A bare `<h2>` has no such attribute, so it falls through to the default (unselected) `<ng-content>` if one exists, otherwise it is dropped. To target the slot the consumer must write `<h2 card-header>Title</h2>`.',
    'Silent content disappearance from a missing default `<ng-content>` is a classic projection bug — always provide a catch-all slot or document the required selectors.',
    ['control-flow', 'content-projection', 'ng-content'],
    ['It renders in the header slot', 'It throws a compile error', 'It does not match the selector and falls to the default slot (or is dropped)', 'It renders twice']),

  q('angular', 'cdk', 3, 'multiple-choice',
    'You build a custom dropdown that must escape `overflow: hidden` ancestors and reposition on scroll. Which Angular CDK primitive fits best?',
    'A',
    'CDK `Overlay` renders content in a top-level container attached to the body, escaping clipping/stacking contexts, and `FlexibleConnectedPositionStrategy` keeps it anchored to a trigger with fallback positions on scroll/resize. `Portal` is the lower-level "render this template elsewhere" tool that Overlay builds on. Drag-drop and virtual-scroll solve unrelated problems.',
    'Hand-rolling popovers with `position: absolute` inevitably breaks inside scrolling/overflow-hidden containers; CDK Overlay exists precisely to handle the positioning + reposition-on-scroll edge cases you would otherwise rediscover painfully.',
    ['cdk', 'overlay', 'portal'],
    ['CDK `Overlay` with a connected position strategy', 'CDK `DragDrop`', 'CDK `VirtualScroll`', 'A plain `position: absolute` div']),

  q('angular', 'testing', 3, 'multiple-choice',
    'How do you configure `TestBed` for a standalone Angular 22 component that has no NgModule?',
    'B',
    'Standalone components are listed in `imports`, not `declarations`: `TestBed.configureTestingModule({ imports: [MyComponent] })`. You add providers (e.g. `provideRouter([])`, mock services) in `providers`. `declarations` is for the legacy NgModule world and is unnecessary — often a hint someone copied an old test.',
    'For a zoneless app, also add `provideZonelessChangeDetection()` (or `provideExperimentalZonelessChangeDetection`) in the test providers, or your `fixture.detectChanges()` assumptions about timing won\'t match production.',
    ['testing', 'testbed', 'standalone'],
    ['Put it in `declarations`', 'Put it in `imports`', 'Wrap it in a generated NgModule', 'It cannot be tested with TestBed']),

  q('angular', 'signals', 3, 'multiple-choice',
    'What does `untracked(() => someSignal())` do inside a `computed` or `effect`?',
    'C',
    '`untracked` reads the signal\'s current value *without* registering it as a dependency, so changes to that signal will not trigger re-execution of the surrounding computed/effect. It is the escape hatch for "I need this value now but don\'t want to react to it later", e.g. reading config inside an effect that should only re-run for other reasons.',
    'Forgetting `untracked` around an incidental read is a common cause of effects firing far more often than intended; conversely, over-using it can hide a dependency you actually wanted.',
    ['signals', 'untracked', 'dependencies'],
    ['Throws if the signal changes', 'Makes the read synchronous', 'Reads the value without creating a reactive dependency', 'Pauses the signal globally']),

  q('angular', 'di', 3, 'multiple-choice',
    'Calling `inject(SomeService)` inside a `setTimeout` callback in a constructor throws "inject() must be called from an injection context". Why?',
    'A',
    'The injection context is only active synchronously during construction/factory execution and certain framework callbacks. By the time a `setTimeout` callback runs, that context has been torn down, so `inject()` has nowhere to resolve from. Capture the dependency synchronously (inject it into a field), or use `runInInjectionContext` with a captured `EnvironmentInjector`.',
    'This bites people moving logic into async callbacks; the fix is almost always "inject at field-init time and reference the field", not to wrap everything in `runInInjectionContext`.',
    ['di', 'injection-context', 'inject'],
    ['The injection context is only active synchronously; the async callback runs after it is gone', '`setTimeout` is not supported in Angular', 'The service was not `providedIn: root`', 'You must use constructor injection for services']),

  q('angular', 'change-detection', 3, 'true-false',
    'In a fully zoneless Angular 22 app, an OnPush component whose template only reads signals will still update correctly when those signals change, even though Zone.js is absent.',
    true,
    'Signal reads in a template register the view as a consumer of those signals. When a signal changes it notifies its consumers, which schedules the view for refresh through Angular\'s own scheduler — no Zone.js required. This is the whole point of signal-based change detection: reactivity is explicit, not inferred from monkey-patched async APIs.',
    'The corollary is the danger: a template that mixes signal reads with plain-field reads will update the signal-driven parts and silently stale the rest — zoneless makes "everything that drives UI must be a signal" a hard rule.',
    ['change-detection', 'zoneless', 'signals', 'onpush']),

  q('angular', 'performance', 3, 'multiple-choice',
    'Which router preloading strategy loads lazy chunks in the background after the app stabilises, trading bandwidth for instant later navigations?',
    'B',
    '`PreloadAllModules` eagerly fetches every lazy route bundle once the initial app is up, so subsequent navigations are instant. `NoPreloading` (the default) loads each chunk only on navigation. A custom strategy can preload selectively (e.g. only routes flagged in `data`). The trade-off is initial-idle bandwidth vs navigation latency.',
    'On a metered or huge app, `PreloadAllModules` can waste bandwidth pulling routes the user never visits; a custom strategy keyed off route `data` (or even link hover) is the grown-up answer.',
    ['performance', 'preloading', 'lazy-routes'],
    ['`NoPreloading`', '`PreloadAllModules`', '`withDebugTracing`', '`withHashLocation`']),

  q('typescript', 'typescript-advanced', 3, 'multiple-choice',
    'Given `type Keys = keyof { a: 1; b: 2 }`, and `type V = Record<Keys, string>`, what is `V`?',
    'C',
    '`keyof { a: 1; b: 2 }` is the union `"a" | "b"`. `Record<"a" | "b", string>` maps each key in that union to `string`, producing `{ a: string; b: string }`. `Record<K, T>` is a mapped type that iterates the union `K`.',
    'Reaching for `Record<Union, T>` instead of an interface is the right call when keys are derived from another type — it stays in sync automatically if the source union grows.',
    ['typescript-advanced', 'keyof', 'record'],
    ['`{ a: 1; b: 2 }`', '`string`', '`{ a: string; b: string }`', '`Record<string, string>`']),

  q('typescript', 'typescript-advanced', 3, 'multiple-choice',
    'Why might `as const` on `const sizes = [10, 20, 40] as const;` be preferable to a plain array when you want a union type `10 | 20 | 40`?',
    'A',
    '`as const` makes the array deeply readonly and narrows element types to their literal values, so `typeof sizes[number]` yields `10 | 20 | 40` rather than `number`. Without it, the array is `number[]` and the literal information is lost. This is the standard trick for deriving a union from a runtime list.',
    'Deriving the union from the same array you iterate in the UI keeps the type and the rendered options provably in sync — add a size and both update from one edit.',
    ['typescript-advanced', 'as-const', 'literal-types'],
    ['It narrows elements to literals so `typeof sizes[number]` is `10|20|40`', 'It makes the array faster', 'It enables array mutation', 'It converts the array to a tuple of strings']),

  q('javascript', 'closures', 3, 'multiple-choice',
    'What does this log?\n```js\nfunction make() {\n  let count = 0;\n  return { inc: () => ++count, get: () => count };\n}\nconst a = make(); a.inc(); a.inc();\nconst b = make();\nconsole.log(a.get(), b.get());\n```',
    'B',
    'Each call to `make()` creates a fresh lexical environment, so `a` and `b` close over independent `count` bindings. `a.inc()` twice makes `a.get()` return `2`; `b` is untouched and returns `0`. This per-invocation closure isolation is the basis of the module/factory pattern.',
    'This isolation is exactly why factory functions are a clean alternative to classes for private state — but be wary of accidentally sharing a closure variable across instances when you hoist a factory\'s state out by mistake.',
    ['closures', 'lexical-scope', 'factory'],
    ['`2 2`', '`2 0`', '`0 0`', '`undefined undefined`']),

  q('angular', 'control-flow', 3, 'multiple-choice',
    'You have a `TemplateRef` and want to render it with a custom context object. Which API renders it?',
    'B',
    '`ngTemplateOutlet` renders a `TemplateRef`, and `ngTemplateOutletContext` supplies the context object whose properties are exposed via `let-` bindings in the template. This is how you build flexible, slot-style APIs (e.g. a table that lets the parent define each cell). `ng-content` projects existing DOM; `ngTemplateOutlet` instantiates a template you hold a reference to.',
    'Template-outlet APIs are powerful but their context typing is weak by default — expose a typed context interface and a static `ngTemplateContextGuard` so consumers get IntelliSense on `let-` variables.',
    ['control-flow', 'ngtemplateoutlet', 'templateref'],
    ['`ng-content select`', '`ngTemplateOutlet` with `ngTemplateOutletContext`', '`ViewContainerRef.createComponent`', '`innerHTML` binding']),

  q('angular', 'signals', 3, 'multiple-choice',
    'A child component declares `value = input.required<string>()`. What is true about this signal input?',
    'D',
    '`input.required<string>()` is a signal-based input: it is read as `this.value()`, it is read-only, and `required` means Angular throws at runtime if the parent never binds it. Signal inputs integrate with change detection and `computed`/`effect` natively, unlike the old `@Input()` decorator field. There is no setter — you transform via the `transform` option or a downstream `computed`.',
    'Signal inputs make derived state trivial (`fullName = computed(() => this.first() + this.last())`) and remove the `ngOnChanges` dance — but `required` inputs throw if a test forgets to set them, so component tests must bind them.',
    ['signals', 'input', 'signal-inputs'],
    ['It is writable from the child', 'It needs `ngOnChanges` to observe updates', 'It is read via `.value`', 'It is read-only via `this.value()` and throws if the parent never binds it']),

  q('angular', 'change-detection', 3, 'multiple-choice',
    'Which is the modern, signal-friendly way to reflect component state onto a host element class in Angular 22?',
    'A',
    'A host binding can reference a signal: `host: { "[class.is-active]": "active()" }` (or the `@HostBinding`/computed equivalent) updates the host class reactively when the `active` signal changes. Direct `nativeElement.classList` manipulation bypasses Angular and breaks SSR/testing assumptions. The template/host-binding path keeps DOM updates declarative.',
    'Keeping host state declarative (host bindings over manual `classList`) is what lets OnPush/zoneless components stay correct — every imperative DOM poke is a place CD can\'t see.',
    ['change-detection', 'host-binding', 'signals'],
    ['A host binding `"[class.is-active]": "active()"` driven by a signal', 'Calling `el.nativeElement.classList.add` in an effect', 'Using `document.querySelector`', 'A global stylesheet toggle']),

  q('angular', 'cdk', 3, 'true-false',
    'CDK `cdkDropList` + `cdkDrag` can reorder a list, but you must still update your underlying data array yourself in the `(cdkDropListDropped)` handler for the new order to persist.',
    true,
    'CDK drag-drop handles the pointer interaction, preview, and placeholder, and gives you `previousIndex`/`currentIndex` in the drop event — but it does not own your data. You call `moveItemInArray(data, previousIndex, currentIndex)` (or the equivalent on a signal) to commit the reorder. Skipping that makes the item snap back on the next render.',
    'With signals, mutate via an immutable update (`items.update(a => moveItemInArray([...a], from, to))`) so OnPush/zoneless CD sees a new reference and the reorder sticks.',
    ['cdk', 'drag-drop', 'state']),

  q('angular', 'cdk', 3, 'multiple-choice',
    'Why does a CDK `cdk-virtual-scroll-viewport` only render a handful of DOM nodes for a 10,000-item list?',
    'C',
    'Virtual scrolling renders only the items currently within (plus a small buffer around) the viewport, recycling DOM nodes as you scroll and using a spacer to preserve the correct scrollbar size. This keeps the node count constant regardless of list length, which is what makes huge lists smooth. It requires a known/strategised item size to compute offsets.',
    'The catch is variable-height items: the default `FixedSizeVirtualScrollStrategy` assumes uniform rows, so dynamic content needs the autosize strategy or it mispositions — a frequent "why is my scroll jumpy" bug.',
    ['cdk', 'virtual-scroll', 'performance'],
    ['It lazy-loads data from the server', 'It uses CSS `content-visibility` only', 'It renders only items in/near the viewport and recycles nodes', 'It paginates into pages of 50']),

  q('angular', 'router', 3, 'multiple-choice',
    'How is a route resolver expressed in modern Angular 22?',
    'B',
    'A resolver is a `ResolveFn<T>`: a plain function `(route, state) => T | Observable<T> | Promise<T>` registered in the route\'s `resolve` map, typically using `inject()` for dependencies. The resolved value is available via the activated route\'s `data`. It replaces the class-based `Resolve` interface.',
    'Resolvers block navigation until they settle, so a slow resolver makes the app feel frozen with no spinner — for non-critical data prefer rendering the route and loading via `resource()` with a loading state.',
    ['router', 'resolver', 'functional'],
    ['A class implementing `Resolve<T>`', 'A `ResolveFn<T>` function using `inject()`', 'A guard that returns data', 'A provider in `app.config`']),

  q('angular', 'rxjs-interop', 3, 'multiple-choice',
    'What does `toObservable(mySignal)` produce, and when does it emit?',
    'A',
    '`toObservable` bridges a signal into an Observable that emits the current value on subscription and then on each change, using an internal effect to track the signal. Emissions are scheduled (microtask), not perfectly synchronous, so rapid intermediate values may be coalesced to the latest. It must be created in an injection context because it sets up an effect.',
    'The coalescing matters: `toObservable` is not a faithful log of every signal write — if you need every transition (e.g. for analytics) drive the Observable side directly rather than round-tripping through a signal.',
    ['rxjs-interop', 'toobservable', 'signals'],
    ['An Observable emitting the current value then subsequent changes (microtask-scheduled)', 'A one-shot Observable that completes immediately', 'A Subject you must manually next()', 'Nothing until you call `.connect()`']),

  q('angular', 'signals', 3, 'multiple-choice',
    'An `effect()` sets up a subscription/timer on each run. How do you tear down the previous run\'s resource before the next run?',
    'C',
    'The effect callback receives an `onCleanup` registration function: `effect((onCleanup) => { const id = setInterval(...); onCleanup(() => clearInterval(id)); })`. Angular invokes the registered cleanup before the next run and on destroy. Without it, each re-run leaks the prior timer/subscription.',
    'Cleanup-on-re-run is the effect equivalent of `switchMap`\'s teardown; forgetting it in an effect that reacts to a frequently-changing signal is a classic accumulating-listeners leak.',
    ['signals', 'effect', 'cleanup'],
    ['Return a disposer from the effect', 'Use `ngOnDestroy`', 'Register `onCleanup(() => ...)` inside the effect', 'It cleans up automatically with no code']),

  q('angular', 'performance', 3, 'multiple-choice',
    'A `@defer (on viewport) { <heavy-chart /> } @placeholder { <skeleton /> } @loading (after 100ms) { <spinner /> }` block. What does `after 100ms` on `@loading` do?',
    'B',
    'The `@loading` block shows while the deferred chunk is being fetched, and `after 100ms` delays showing it so that fast loads (e.g. cached chunks) never flash a spinner. The `@placeholder` shows before the trigger fires; `@loading` shows during fetch. The `minimum`/`after` parameters exist precisely to avoid spinner flicker.',
    'These anti-flicker knobs (`after`, `minimum`) are what separate a polished `@defer` from a janky one — without `after`, fast networks show a distracting 30ms spinner blink.',
    ['performance', 'defer', 'loading'],
    ['Aborts the load after 100ms', 'Delays showing the loading UI for 100ms to avoid spinner flicker', 'Retries every 100ms', 'Caches the chunk for 100ms']),

  q('angular', 'control-flow', 3, 'multiple-choice',
    'With `@switch (status())` and several `@case` blocks plus a `@default`, how does Angular compare the case values to the switch value?',
    'A',
    '`@switch`/`@case` use strict equality (`===`) between the switch expression and each case expression, like a JavaScript `switch`. Only the first matching case renders; `@default` renders if none match. Because it is `===`, comparing against object references rather than primitives rarely matches as intended.',
    'Switching on a string-literal union derived from a signal gives you exhaustive, type-checked branches — switching on object identity is the usual cause of "my default always renders" confusion.',
    ['control-flow', 'switch', 'equality'],
    ['Strict `===` equality; first match wins, else `@default`', 'Loose `==` equality', 'Deep structural equality', 'Regex matching']),

  q('angular', 'di', 3, 'true-false',
    'Providing a service in a lazy-loaded route\'s `providers` array creates an instance scoped to that route subtree, distinct from a root-provided instance of the same token.',
    true,
    'Route-level `providers` create a child injector for that route and its children, so a service provided there is a separate instance from one provided in root. This is how you scope feature state to a route without it leaking app-wide. The lookup walks up the injector hierarchy, so root-provided dependencies are still reachable.',
    'Route-scoped providers are great for "state that should die when you leave the feature", but accidentally re-providing a meant-to-be-singleton service here causes baffling duplicate-instance bugs.',
    ['di', 'hierarchical-injectors', 'route-providers']),

  q('typescript', 'typescript-advanced', 3, 'multiple-choice',
    'What does the `satisfies` operator do in `const config = { size: 10 } satisfies TestConfig;`?',
    'C',
    '`satisfies` checks that the expression conforms to a type *without* widening or changing the inferred type of the expression. So `config` keeps its narrow literal type (`{ size: 10 }`) while still being validated against `TestConfig`. Contrast with a `: TestConfig` annotation, which would widen `config` to `TestConfig` and lose the literal information.',
    'Use `satisfies` for config objects where you want both validation and precise inference (e.g. keeping literal keys for later indexing) — annotation throws that precision away.',
    ['typescript-advanced', 'satisfies', 'inference'],
    ['It casts the value at runtime', 'It is identical to `as TestConfig`', 'It validates against the type while preserving the narrow inferred type', 'It makes the object readonly']),

  q('javascript', 'promises', 3, 'multiple-choice',
    'What is the difference between `Promise.all` and `Promise.allSettled`?',
    'A',
    '`Promise.all` rejects as soon as any input promise rejects, discarding the other results (though they still run). `Promise.allSettled` always resolves with an array of `{ status, value | reason }` objects describing each outcome, never short-circuiting. Choose `allSettled` when you need every result regardless of individual failures.',
    'Using `all` for independent best-effort calls (e.g. firing several analytics beacons) means one failure hides the rest — `allSettled` is the right tool when partial success is acceptable.',
    ['promises', 'promise-all', 'allsettled'],
    ['`all` rejects on first failure; `allSettled` waits for every outcome', 'They are identical', '`allSettled` runs sequentially', '`all` ignores rejections']),

  q('javascript', 'closures', 3, 'multiple-choice',
    'What does `[1, 2, 3].map(parseInt)` return?',
    'B',
    '`map` calls the callback with `(value, index)`, and `parseInt(string, radix)` uses the second argument as the radix. So it evaluates `parseInt("1",0)=1`, `parseInt("2",1)=NaN` (radix 1 is invalid), `parseInt("3",2)=NaN` (3 is not a valid base-2 digit). The result is `[1, NaN, NaN]`.',
    'This is the canonical "callback arity mismatch" gotcha — passing a built-in with optional extra parameters to `map` silently feeds it the index; wrap it (`x => parseInt(x, 10)`) to be safe.',
    ['closures', 'map', 'parseint'],
    ['`[1, 2, 3]`', '`[1, NaN, NaN]`', '`[NaN, NaN, NaN]`', '`[1, 2, NaN]`']),

  q('web', 'browser-apis', 3, 'multiple-choice',
    'What is the practical difference between `requestAnimationFrame` and `setTimeout(fn, 16)` for visual updates?',
    'A',
    '`requestAnimationFrame` schedules the callback to run right before the browser\'s next paint, synced to the display refresh rate and paused in background tabs. `setTimeout(fn, 16)` fires on a timer unrelated to paint, can drift, runs in background tabs, and may cause extra layout/paint passes. rAF gives smoother, more efficient animation.',
    'For DOM-measuring work after a render, Angular\'s `afterNextRender`/`afterEveryRender` is the framework-aware equivalent — it batches with Angular\'s own render timing instead of racing it like a bare rAF or timeout.',
    ['browser-apis', 'requestanimationframe', 'rendering'],
    ['rAF syncs to paint and pauses in background tabs; setTimeout does not', 'They are identical', 'setTimeout is always smoother', 'rAF runs on a worker thread']),

  q('web', 'security', 3, 'multiple-choice',
    'Why is storing a JWT in `localStorage` often discouraged compared with an `HttpOnly` cookie?',
    'B',
    'A token in `localStorage` is readable by any JavaScript running on the page, so a single XSS flaw can exfiltrate it. An `HttpOnly` cookie is not accessible to JavaScript, removing that exfiltration vector (though it introduces CSRF concerns to manage). The trade-off is XSS-token-theft vs CSRF, each with different mitigations.',
    'There is no universally "secure" client token store — the senior move is to name the threat model (XSS vs CSRF) and pick mitigations (CSP + HttpOnly + SameSite) accordingly, not to declare one storage "safe".',
    ['security', 'jwt', 'xss'],
    ['localStorage is slower', 'localStorage tokens are readable by any JS, so XSS can steal them', 'Cookies cannot store tokens', 'localStorage is not supported on HTTPS']),

  q('web', 'http', 3, 'true-false',
    'An HTTP response with `Cache-Control: no-store` instructs the browser not to write the response to any cache, whereas `no-cache` allows caching but requires revalidation before reuse.',
    true,
    '`no-store` forbids persisting the response at all — every request hits the network. `no-cache` permits storing but forces the cache to revalidate with the origin (e.g. via ETag) before serving it. They are commonly confused; `no-cache` does *not* mean "do not cache".',
    'This distinction is exactly why the deploy script sets `no-cache, no-store, must-revalidate` on `index.html` but a long `max-age` on hashed assets — the HTML must always re-check, the fingerprinted bundles never need to.',
    ['http', 'cache-control', 'caching']),

  // ---- Level 4 — expert (34) -------------------------------------------------
  q('angular', 'signals', 4, 'multiple-choice',
    'Consider:\n```ts\nconst a = signal(1);\nconst b = computed(() => a() * 2);\nconst c = computed(() => a() + b());\neffect(() => console.log(c()));\na.set(5);\n```\nHow many times does the effect log, and is `c` ever observed in an inconsistent state (e.g. using old `a` with new `b`)?',
    'C',
    'Angular\'s reactive graph is glitch-free: when `a` changes, `b` and `c` are marked stale and recomputed consistently, and the effect runs once per settled change, not once per intermediate dependency. So the effect logs the initial value, then once after `a.set(5)` — total twice — and never sees a torn state mixing old `a` with new `b`.',
    'Glitch-freedom is a correctness guarantee you should rely on: it is why you can build deep computed graphs without defensive recomputation — but it also means you cannot observe intermediate values, which occasionally surprises people debugging.',
    ['signals', 'computed', 'glitch-free'],
    ['Logs 3 times; can be inconsistent', 'Logs once; consistent', 'Logs twice (initial + after set); always consistent', 'Logs twice; can briefly be inconsistent']),

  q('angular', 'signals', 4, 'true-false',
    'Two consecutive `count.set(5)` calls when `count` already holds `5` will not notify dependents, because signals use a default referential/`Object.is` equality check to skip no-op updates.',
    true,
    'Writable signals apply an equality function (default `Object.is`) and skip notification when the new value is equal to the current one. Setting `5` when it is already `5` is a no-op that triggers no recomputation. For object values this means in-place mutation followed by `set(sameRef)` is ALSO skipped — you must pass a new reference or a custom `equal`.',
    'The default `Object.is` equality is why mutate-then-set-same-reference silently does nothing for objects/arrays; teams that mutate state must either clone on write or supply a structural `equal` function.',
    ['signals', 'equality', 'object-is']),

  q('angular', 'http', 4, 'multiple-choice',
    'What is the difference between a `resource()` re-running due to a changed request signal versus calling `resource.reload()`?',
    'A',
    'A changed request signal produces a *new* request value, so the resource recomputes and the loader runs for new inputs, typically resetting `value` toward the new load. `reload()` re-runs the loader for the *same* request (e.g. to refetch unchanged params), keeping the prior value available while loading. Both abort any in-flight load.',
    'The subtlety is `value()` retention: on `reload()` you usually keep showing stale data with an `isLoading()` overlay, whereas a request change conceptually targets different data — model your UI states accordingly.',
    ['http', 'resource', 'reload'],
    ['Request change loads new inputs; reload re-runs the loader for the same request', 'They are identical', 'reload() clears the cache globally', 'Request change does not abort in-flight loads']),

  q('angular', 'forms', 4, 'multiple-choice',
    'A Signal Forms async validator checks username availability over HTTP. While it is pending, what is the control\'s validity status?',
    'B',
    'While an async validator is in flight the control\'s status is `pending` — it is neither valid nor invalid yet. Sync validators run first and must pass before async validators are invoked (no point hitting the server for an empty field). The template typically disables submit while any control is `pending`.',
    'Debounce the async check and gate it behind sync validity, or you hammer the server on every keystroke and race responses — and remember `pending` is a third state your submit logic must handle, not just valid/invalid.',
    ['forms', 'signal-forms', 'async-validator'],
    ['valid', 'pending', 'invalid', 'disabled']),

  q('angular', 'change-detection', 4, 'multiple-choice',
    'A colleague calls `cdr.detectChanges()` inside `ngAfterViewInit` to fix an `ExpressionChangedAfterItHasBeenCheckedError`. Why is this a fragile fix and what is usually better?',
    'C',
    'The error means a value bound in the template changed after Angular checked it within the same tick, usually because `ngAfterViewInit` mutates state the view already read. Forcing a synchronous `detectChanges()` papers over it by re-checking, but it adds an extra CD pass and can mask a real ordering problem. Moving the state into a signal (or setting it earlier, e.g. in the constructor / via `afterNextRender`) fixes the timing properly.',
    'In dev mode Angular runs a second CD pass to catch exactly this; the right instinct is "why did my value change after read?" — signals usually dissolve the problem because their updates schedule a clean follow-up pass instead of a same-tick mutation.',
    ['change-detection', 'expressionchanged', 'lifecycle'],
    ['It is the recommended fix', 'It disables OnPush', 'It adds an extra CD pass and masks a timing issue; signals/earlier-set fix it properly', 'It only works in zoneless mode']),

  q('angular', 'di', 4, 'multiple-choice',
    'You register `{ provide: TOKEN, useValue: "a", multi: true }` and `{ provide: TOKEN, useValue: "b", multi: true }`. What does `inject(TOKEN)` return?',
    'D',
    'With `multi: true`, all providers for the same token contribute to a single injected *array*. So `inject(TOKEN)` returns `["a", "b"]` rather than the last value winning. This is the mechanism behind extensible token sets like `HTTP_INTERCEPTORS`. Mixing `multi: true` and non-multi for the same token is an error.',
    'Multi-providers are the supported extension point for cross-cutting concerns (interceptors, initializers); a non-multi re-provide silently replaces, which is the bug when someone expects their interceptor to be added but it clobbers another.',
    ['di', 'multi-provider', 'tokens'],
    ['`"a"`', '`"b"`', '`"ab"`', '`["a", "b"]`']),

  q('angular', 'rxjs-interop', 4, 'true-false',
    'Calling `toSignal(source$)` without `{ requireSync: true }` on a synchronous `BehaviorSubject` still types the signal as `T | undefined`, even though at runtime it will always have a value.',
    true,
    '`toSignal` cannot know at the type level that the source emits synchronously, so by default it widens to `T | undefined` to account for the gap before the first emission. `{ requireSync: true }` asserts synchronous emission, narrows to `T`, and throws at runtime if the source did not emit synchronously. Use it only when you are certain (e.g. `BehaviorSubject`, `startWith`).',
    'Reaching for `requireSync: true` on a genuinely synchronous source removes a needless `| undefined` from every consumer — but use it on an async source and you trade a compile-time `undefined` for a runtime crash.',
    ['rxjs-interop', 'tosignal', 'requiresync']),

  q('angular', 'change-detection', 4, 'multiple-choice',
    'In a zoneless app you integrate a third-party library that updates the DOM/state inside its own `setTimeout` and you bind that state in a template via a plain field. The view never updates. What is the minimal correct fix?',
    'A',
    'Without Zone.js nothing schedules CD when the library mutates a plain field in a timer. The minimal reactive fix is to route that state through a signal you `set()` in the callback (optionally via `inject(NgZone).run` or `ApplicationRef.tick` if you must, but a signal is cleaner). Re-adding Zone.js for one library is a heavy regression.',
    'The disciplined pattern for third-party integration in zoneless apps is a thin signal-backed adapter: the library writes, you `set()` a signal, the template reads it — keeping the rest of the app off Zone.js.',
    ['change-detection', 'zoneless', 'interop'],
    ['Store the library\'s value in a signal and `set()` it in the callback', 'Re-enable Zone.js globally', 'Call `console.log` to force a render', 'Add `ChangeDetectionStrategy.Default`']),

  q('angular', 'performance', 4, 'multiple-choice',
    'A `@defer (on interaction; prefetch on idle)` block. What is the effect of the `prefetch on idle` part?',
    'B',
    'The render trigger (`on interaction`) controls when the deferred content is *shown*; `prefetch on idle` independently controls when the JavaScript chunk is *downloaded* — here, during browser idle time before the user interacts. This way the chunk is already in cache when the interaction fires, so rendering is instant. Prefetch and render triggers are decoupled by design.',
    'Decoupling prefetch from render is the pro move for "instant on click" UX: download during idle, render on interaction — the user never waits on the network, and you never block initial load with the chunk.',
    ['performance', 'defer', 'prefetch'],
    ['It renders the block on idle', 'It downloads the chunk during idle so render-on-interaction is instant', 'It aborts the load on idle', 'It is a no-op']),

  q('angular', 'control-flow', 4, 'multiple-choice',
    'A component uses `<ng-content />` with default/fallback content: `<ng-content>Fallback</ng-content>`. When does "Fallback" render?',
    'C',
    'Default content inside `<ng-content>` (supported since Angular 18) renders only when the consumer projects nothing into that slot. If the parent supplies any matching projected content, the fallback is replaced. This removes the old `@if (hasProjectedContent)` workarounds for empty-slot states.',
    'Fallback `ng-content` is cleaner than detecting projected content imperatively, but note it keys off *presence*, not emptiness — a projected whitespace-only node still counts as content and suppresses the fallback.',
    ['control-flow', 'content-projection', 'fallback'],
    ['Always', 'Never', 'Only when the consumer projects nothing into that slot', 'Only in OnPush components']),

  q('angular', 'cdk', 4, 'multiple-choice',
    'A CDK Overlay dropdown stays open and detached from its trigger when the user scrolls the page. Which configuration most directly addresses this?',
    'A',
    'The overlay\'s `ScrollStrategy` governs scroll behaviour: `reposition()` keeps it glued to the trigger, `close()` dismisses it on scroll, `block()` prevents page scroll. The default `noop()` leaves it floating detached. Choosing `reposition` (or `close`) fixes the "floating away" symptom; the position strategy then handles the actual anchoring.',
    'Pair a `reposition` scroll strategy with a `FlexibleConnectedPositionStrategy` that has fallback positions, or your dropdown will reposition itself right off-screen at viewport edges.',
    ['cdk', 'overlay', 'scroll-strategy'],
    ['Set a `reposition` (or `close`) ScrollStrategy on the overlay', 'Use `position: sticky`', 'Disable page scrolling permanently', 'Add `cdkScrollable` to the body only']),

  q('angular', 'testing', 4, 'multiple-choice',
    'You test a component that loads via `resource()`/`fetch`. Why might wrapping the assertion in `fakeAsync`/`tick()` be the wrong tool here?',
    'B',
    '`fakeAsync` virtualises timers and zone-based macro/microtasks, but a real `fetch`-based resource uses the actual network/`Promise` microtask queue and is not always controllable by `tick()` (especially zoneless, where there is no zone to drain). The robust approach is to await the real async settle (e.g. `await fixture.whenStable()` / awaiting the promise) or to inject a fake loader you resolve manually.',
    'In zoneless tests `fakeAsync` loses much of its power because there is no NgZone to coordinate; prefer injecting a controllable loader/HTTP testing backend so you deterministically resolve the resource rather than fighting timer virtualisation.',
    ['testing', 'fakeasync', 'resource'],
    ['fakeAsync always works with fetch', 'fetch uses the real microtask/network queue that tick() may not control, especially zoneless', 'resource() cannot be tested', 'You must use real HTTP in tests']),

  q('angular', 'signals', 4, 'multiple-choice',
    'What happens if you call `mySignal.set(...)` synchronously inside a `computed()` body?',
    'D',
    'Computeds must be pure derivations — Angular throws if you attempt to write to a signal during a computed\'s computation, because side effects in a pure derivation would make the reactive graph nondeterministic. Writes belong in event handlers or effects (and even effects warn against writing to signals they read). The correct place to derive a value is the computed\'s return, not a side-effecting set.',
    'The "no writes in computed" rule is enforced precisely to keep the graph glitch-free; when you feel the urge to set inside a computed, you actually want either another computed or a `linkedSignal`.',
    ['signals', 'computed', 'purity'],
    ['It silently works', 'It schedules the write for later', 'It is a no-op', 'Angular throws — computeds must be pure (no signal writes)']),

  q('angular', 'di', 4, 'multiple-choice',
    'An `InjectionToken` factory needs another service: `new InjectionToken("x", { providedIn: "root", factory: () => ... })`. How do you obtain that dependency inside the factory?',
    'A',
    'Inside a token factory you are in an injection context, so you call `inject(OtherService)` directly within the factory body. The old `deps: [...]` array on provider definitions is the alternative for `useFactory` providers, but for tree-shakable token factories `inject()` is idiomatic. Trying to pass it as a factory parameter does not work.',
    'Token factories using `inject()` keep dependencies tree-shakable and colocated, but they only run lazily on first injection — so any work with side effects in a factory is deferred, which occasionally surprises people expecting eager init.',
    ['di', 'injectiontoken', 'factory'],
    ['Call `inject(OtherService)` inside the factory', 'Pass it as a factory argument', 'Use `@Inject` on the token', 'It is impossible; tokens cannot have deps']),

  q('angular', 'control-flow', 4, 'multiple-choice',
    'You project a component but want it to match a different `ng-content select` slot than its own tag name suggests. Which attribute helps?',
    'C',
    '`ngProjectAs` lets a projected node masquerade as a different selector for content-projection matching: `<my-thing ngProjectAs="[header]">` will match `<ng-content select="[header]">` even though the element itself does not carry that attribute. It is essential when wrapping content in `<ng-container>` that would otherwise not match the parent\'s selectors.',
    '`ngProjectAs` is the escape hatch when a structural wrapper (`<ng-container>`) breaks projection matching — without it, wrapping projected content can silently send it to the default slot.',
    ['control-flow', 'content-projection', 'ngprojectas'],
    ['`projectAs`', '`contentChild`', '`ngProjectAs`', '`select`']),

  q('typescript', 'typescript-advanced', 4, 'multiple-choice',
    'What does this conditional type resolve to?\n```ts\ntype Unwrap<T> = T extends Promise<infer U> ? U : T;\ntype A = Unwrap<Promise<string>>;\ntype B = Unwrap<number>;\n```',
    'A',
    '`infer U` captures the type parameter inside `Promise<...>` when the conditional matches. `Unwrap<Promise<string>>` matches the `Promise<infer U>` branch with `U = string`, so `A = string`. `Unwrap<number>` does not match `Promise<...>`, so it falls to the else branch: `B = number`.',
    '`infer` in conditional types is the basis of utilities like `Awaited`, `ReturnType`, and `Parameters`; recognising it is what lets you read and write the type-level plumbing in real libraries.',
    ['typescript-advanced', 'conditional-types', 'infer'],
    ['`A = string`, `B = number`', '`A = Promise<string>`, `B = number`', '`A = string`, `B = never`', '`A = unknown`, `B = unknown`']),

  q('javascript', 'promises', 4, 'multiple-choice',
    'What does this log?\n```js\nasync function f() {\n  console.log(1);\n  await null;\n  console.log(2);\n}\nconsole.log(0);\nf();\nconsole.log(3);\n```',
    'B',
    'Everything up to the first `await` runs synchronously: `0`, then calling `f()` logs `1`, and `await null` suspends `f`, yielding control. Synchronous code continues: `3`. The continuation after `await` is a microtask, so `2` logs last. Order: `0 1 3 2`.',
    'Even `await` on a non-promise (`null`) always defers the continuation to a microtask — a subtle point that explains why "await of a constant" still reorders execution and can change observable side-effect ordering.',
    ['promises', 'async-await', 'microtask'],
    ['`0 1 2 3`', '`0 1 3 2`', '`0 3 1 2`', '`1 0 3 2`']),

  q('angular', 'signals', 4, 'multiple-choice',
    'A child declares `value = model<string>("")`. What does `model()` give you over a plain signal `input`?',
    'B',
    '`model()` creates a *writable* signal input that also exposes a matching output, enabling two-way binding `[(value)]="parentSignal"` from the parent. Writing `this.value.set(...)` in the child both updates locally and emits to the parent. A plain `input` is read-only in the child and cannot propagate changes back up.',
    '`model()` is the signal-era replacement for the `@Input()`/`@Output()` banana-in-a-box pair; the gotcha is that every child write propagates to the parent, so it is for genuine two-way controls (form fields, toggles), not internal state.',
    ['signals', 'model', 'two-way-binding'],
    ['Nothing; they are identical', 'A writable input plus a paired output enabling `[(value)]` two-way binding', 'A faster input', 'An input that cannot be bound']),

  q('angular', 'signals', 4, 'multiple-choice',
    'You query a child element with `el = viewChild<ElementRef>("ref")`. When is `el()` guaranteed to be populated?',
    'C',
    'Signal queries (`viewChild`) resolve after the view is initialised; reading `el()` too early (e.g. in the constructor) returns `undefined`. They update reactively as the view changes, so the safe place to use the result for DOM work is `afterNextRender`/`afterEveryRender` or inside a `computed`/`effect` that tolerates the initial `undefined`. The query signal is typed `T | undefined` unless declared `.required`.',
    'Pairing `viewChild` with `afterNextRender` for focus/measurement is the idiomatic Angular 22 pattern — reading the query in the constructor or field initialiser is the classic "it\'s undefined" mistake.',
    ['signals', 'viewchild', 'queries'],
    ['In the constructor', 'Never', 'After view init — use `afterNextRender`/effect; it is `undefined` earlier', 'Only with Zone.js']),

  q('angular', 'signals', 4, 'multiple-choice',
    'A signal input transforms its value: `disabled = input(false, { transform: booleanAttribute })`. What problem does `transform` solve here?',
    'A',
    '`booleanAttribute` coerces attribute-style values (e.g. the bare presence `disabled=""`, the string `"true"`) into a real boolean at the input boundary. Without it, `<cmp disabled>` would pass the empty string `""` (falsy) and `disabled="false"` would pass a truthy non-empty string. `transform` runs on every binding update before the signal stores the value.',
    'Attribute coercion (`booleanAttribute`, `numberAttribute`) is essential for component public APIs consumed as HTML attributes; skipping it produces the infamous `disabled="false"` that is actually truthy.',
    ['signals', 'input-transform', 'coercion'],
    ['It coerces attribute strings (e.g. "") into a real boolean', 'It makes the input async', 'It validates the value', 'It makes the input two-way']),

  q('angular', 'change-detection', 4, 'multiple-choice',
    'What is the difference between `afterNextRender` and `afterEveryRender` in Angular 22?',
    'B',
    '`afterNextRender` runs its callback once, after the next render completes; `afterEveryRender` runs after every render. Both run only in the browser (skipped during SSR) and are the supported place for direct DOM reads/writes that must happen post-render. They replace ad-hoc `ngAfterViewInit`/`setTimeout` DOM hacks and respect Angular\'s render timing.',
    'Use `afterNextRender` for one-shot setup (focus, third-party widget init) and `afterEveryRender` sparingly for continuous measurement — the latter runs a lot, so heavy work there silently tanks performance.',
    ['change-detection', 'afternextrender', 'rendering'],
    ['They are identical', '`afterNextRender` runs once; `afterEveryRender` runs after every render', '`afterEveryRender` runs only on SSR', 'Both run during SSR']),

  q('angular', 'rxjs-interop', 4, 'true-false',
    'Calling `takeUntilDestroyed()` with no `DestroyRef` argument outside of an injection context throws an error.',
    true,
    '`takeUntilDestroyed()` with no argument captures the ambient `DestroyRef` from the current injection context, so it must be called where one is active (field initialiser, constructor, factory). Called later (e.g. inside a callback), there is no context and it throws. The workaround is to capture a `DestroyRef` via `inject(DestroyRef)` synchronously and pass it explicitly.',
    'This trips people who move pipe setup into async callbacks; the fix is to grab `inject(DestroyRef)` up front and pass it to `takeUntilDestroyed(destroyRef)` wherever you need it.',
    ['rxjs-interop', 'takeuntildestroyed', 'injection-context']),

  q('angular', 'http', 4, 'multiple-choice',
    'A `resource()` loader throws (network error). How should the template reflect this, and what is the resource\'s state?',
    'C',
    'On a thrown/rejected loader the resource transitions to `status() === "error"` and exposes the thrown value via `error()`, while `value()` is typically `undefined` (or retains last value depending on config). The template should branch on status to show an error UI with a retry that calls `reload()`. The error does not propagate as an uncaught exception — it is captured into the resource\'s reactive state.',
    'Because the error is surfaced as state rather than thrown, you must explicitly render an error branch — forgetting it gives a silent blank panel on failure, which is a common oversight when migrating from try/catch HTTP code.',
    ['http', 'resource', 'error-handling'],
    ['It re-throws synchronously', 'value() becomes the error', 'status() is "error", error() holds the thrown value; branch and offer reload()', 'The component is destroyed']),

  q('angular', 'di', 4, 'multiple-choice',
    'In a zoneless app, when is `NgZone.runOutsideAngular` still meaningful?',
    'D',
    'In a fully zoneless app there is no Zone driving change detection, so `runOutsideAngular` has little to coordinate — CD is triggered by signals/events explicitly. It mainly matters in zone-based apps to keep high-frequency work (scroll, animation frames) from triggering CD. In zoneless code you simply do the work and only `set()` a signal when you actually want the UI to react.',
    'A lot of "perf" advice about `runOutsideAngular` is obsolete in zoneless apps; the equivalent discipline is "do not write a UI signal unless the UI should change", which is far more explicit.',
    ['di', 'ngzone', 'zoneless'],
    ['It speeds up signals', 'It is required for effects', 'It disables OnPush', 'It is largely moot — without a zone, CD is driven by explicit signal/event notifications']),

  q('angular', 'performance', 4, 'multiple-choice',
    'A `@defer` block has an `@error` block. When does it render?',
    'A',
    'The `@error` block renders if loading the deferred dependencies fails (e.g. the lazy chunk 404s or the network drops mid-fetch). It gives deferred views a graceful failure path distinct from `@loading`/`@placeholder`. Without it, a failed chunk load leaves the block empty with no feedback.',
    'Chunk-load failures are real in production (stale `index.html` pointing at a hash that no longer exists after a deploy) — an `@error` block with a reload prompt turns a blank screen into a recoverable state.',
    ['performance', 'defer', 'error'],
    ['When loading the deferred dependencies fails', 'When the trigger never fires', 'On any template error in the block', 'When the placeholder is missing']),

  q('angular', 'change-detection', 4, 'true-false',
    'Writing to a signal inside an `effect()` that also reads that same signal will, by default, produce an Angular error/warning about writing to signals in effects to prevent infinite loops.',
    true,
    'Angular discourages writing to signals from within effects because an effect that writes a signal it (directly or transitively) reads can loop, and even when it does not, it makes data flow hard to reason about. By default this is flagged; the sanctioned escape (when you truly need it) is the `allowSignalWrites` option, used sparingly. The preferred answer is usually `computed` or `linkedSignal`.',
    'When you feel you must write a signal in an effect, 90% of the time a `computed`/`linkedSignal` expresses the intent without the loop risk; reserve `allowSignalWrites` for genuine imperative bridges and document why.',
    ['change-detection', 'effect', 'signal-writes']),

  q('angular', 'cdk', 4, 'multiple-choice',
    'What does CDK `Portal`/`PortalOutlet` fundamentally let you do?',
    'B',
    'A `Portal` is a piece of UI (a template or component) that can be rendered into a `PortalOutlet` located elsewhere in the DOM, decoupling logical ownership from physical render location. Overlay is built on portals. This is what enables dialogs/tooltips to live in a top-level container while being "owned" by a deep component.',
    'Portals are the primitive behind every "render into body" pattern; understanding them demystifies why CDK Overlay content escapes `overflow`/stacking contexts — it is literally rendered into a different part of the tree.',
    ['cdk', 'portal', 'rendering'],
    ['Lazy-load components', 'Render a template/component into an outlet located elsewhere in the DOM', 'Create web workers', 'Virtualise long lists']),

  q('angular', 'router', 4, 'multiple-choice',
    'You enable named view transitions for a hero image across routes. What must match between the two routes for the morph to work?',
    'A',
    'The View Transitions API morphs elements that share the same `view-transition-name` across the old and new DOM. Both the source and destination element must declare the identical `view-transition-name` (and only one element per name may be live at a time). Angular\'s `withViewTransitions()` wraps the swap; the naming is pure CSS.',
    'Duplicate or missing `view-transition-name` values silently disable the morph (or throw about non-unique names) — coordinating those names across lazily-loaded route components is the fiddly part in real apps.',
    ['router', 'view-transitions', 'named'],
    ['Both elements share the same `view-transition-name`', 'Both routes use the same component', 'They must be eagerly loaded', 'They must share a service']),

  q('angular', 'control-flow', 4, 'multiple-choice',
    'Why can a `@for` loop with `track item` (tracking the whole object) behave worse than `track item.id` after the array is replaced with freshly-fetched equivalent data?',
    'C',
    'Tracking by the object reference means that after a refetch (which produces new object identities for logically-equal items) every item is considered new, so Angular destroys and recreates all rows — losing DOM state and wasting work. Tracking by a stable domain key (`item.id`) lets Angular match old and new items and reuse DOM. Reference tracking only reuses when the exact same object instances persist.',
    'This is a subtle perf cliff after server refetches/immutable updates: the data "looks the same" but every reference changed, so reference-tracked lists re-render wholesale — always track by a stable id for server-sourced data.',
    ['control-flow', 'for', 'track'],
    ['No difference', 'Object tracking is always faster', 'Object tracking treats refetched equal items as new, re-rendering everything', 'It throws an error']),

  q('angular', 'testing', 4, 'true-false',
    'When unit-testing a `computed()` signal, you can read its value directly in the test without a TestBed or change-detection cycle, because computeds evaluate on read.',
    true,
    'Signals and computeds are framework-agnostic reactive primitives — they do not require a component, TestBed, or CD pass to evaluate. You can `const c = computed(() => a() * 2)` in a plain test and assert `c()` after `a.set(...)`. Effects, by contrast, are scheduled and need a flush (e.g. `TestBed.flushEffects()` or a tick) to observe.',
    'This makes signal-based business logic delightfully unit-testable in isolation; the line to watch is effects, which are async-scheduled and do need TestBed coordination to run in tests.',
    ['testing', 'signals', 'computed']),

  q('typescript', 'typescript-advanced', 4, 'multiple-choice',
    'What is wrong (at the type level) with this discriminated union narrowing?\n```ts\ntype Shape = { kind: "circle"; r: number } | { kind: "square"; side: number };\nfunction area(s: Shape) {\n  if (s.kind === "circle") return Math.PI * s.r ** 2;\n  return s.side ** 2;\n}\n```',
    'D',
    'Nothing is wrong — this is the correct, idiomatic discriminated-union pattern. The literal `kind` discriminant lets TypeScript narrow `s` to the circle variant inside the `if` (so `s.r` is valid) and to the square variant afterward (so `s.side` is valid). Adding a `default: assertNever(s)` would further guarantee exhaustiveness if a third variant is later added.',
    'The senior upgrade is an exhaustiveness check (`const _exhaustive: never = s`) so that adding a new `kind` becomes a compile error at every switch — turning a silent runtime gap into a caught mistake.',
    ['typescript-advanced', 'discriminated-union', 'narrowing'],
    ['`s.r` is an error', 'The union is invalid', '`kind` cannot be a discriminant', 'Nothing is wrong — narrowing is correct']),

  q('javascript', 'closures', 4, 'multiple-choice',
    'What does this log?\n```js\nconst obj = {\n  name: "A",\n  greet() { return () => this.name; }\n};\nconst g = obj.greet();\nconst { greet } = obj;\nconsole.log(g(), (greet?.() ?? (() => "x"))());\n```',
    'A',
    'Arrow functions capture `this` lexically. `obj.greet()` runs with `this === obj`, and the returned arrow closes over that `this`, so `g()` returns `"A"`. But the destructured `greet` is called as a bare function, so inside it `this` is `undefined` (strict) and `this.name` would throw — except the returned arrow from that call closes over the `undefined` this; calling it throws, so the expression evaluates the right side... Actually the call `greet()` returns an arrow bound to `this=undefined`; invoking it throws on `this.name`. The robust reading: `g()` is `"A"`; the second call throws a TypeError when the inner arrow reads `this.name`.',
    'Method extraction (`const { greet } = obj`) severs the `this` binding — a perennial bug when passing methods as callbacks; bind, wrap in an arrow, or use class fields/arrow methods to preserve `this`.',
    ['closures', 'this', 'arrow-functions'],
    ['`g()` returns "A"; the extracted-then-invoked call loses `this` and throws', 'Both return "A"', 'Both return undefined', 'Both throw']),

  q('web', 'browser-apis', 4, 'multiple-choice',
    'Why might a `ResizeObserver` callback that synchronously writes layout-affecting styles trigger a "ResizeObserver loop limit exceeded" warning?',
    'A',
    'If the observer\'s callback changes styles that alter the observed element\'s size, the browser detects a new resize, queues another callback, and so on — a feedback loop. The browser caps re-delivery per frame and warns when the loop does not settle. The fix is to avoid resizing the observed element from within its own callback, or to debounce/break the cycle.',
    'This loop is easy to create when syncing two panes by size; the disciplined pattern is to compute target sizes without re-triggering the observed dimension, or guard with a "did the value actually change" check.',
    ['browser-apis', 'resizeobserver', 'reflow'],
    ['The callback resizes the observed element, creating a feedback loop', 'ResizeObserver is deprecated', 'It only fires once', 'It runs on a worker']),

  q('web', 'security', 4, 'true-false',
    'Setting `SameSite=Lax` on a session cookie mitigates many CSRF attacks by preventing the cookie from being sent on most cross-site sub-requests, while still sending it on top-level navigations.',
    true,
    '`SameSite=Lax` withholds the cookie from cross-site sub-requests (e.g. a forged `POST` from another origin, image/iframe loads) but still includes it on top-level GET navigations the user initiates. This neutralises the classic auto-submitting-form CSRF for state-changing requests. `Strict` is tighter but can break legitimate inbound links; `None` requires `Secure` and re-opens CSRF surface.',
    '`SameSite=Lax` is a strong default but not a complete CSRF defence (GET-based state changes, same-site subdomains) — pair it with anti-CSRF tokens for sensitive mutations rather than treating it as a silver bullet.',
    ['security', 'csrf', 'samesite']),

  // ---- Level 5 — principal (15) ----------------------------------------------
  q('angular', 'change-detection', 5, 'multiple-choice',
    'In a zoneless, fully signal-driven Angular 22 app, what is the practical role left for `ChangeDetectionStrategy.OnPush`?',
    'C',
    'When every template binding reads signals, the view only refreshes in response to signal notifications regardless of strategy, so `OnPush` vs `Default` largely converge in behaviour. `OnPush` still meaningfully constrains *non-signal* inputs (it skips checks unless an input reference changes or an event fires), which matters at the boundary with legacy `@Input()` components. The framework is heading toward signals making the strategy distinction mostly historical for new code.',
    'The honest principal answer is "for fully-signal components it is nearly moot, but keep it for correctness at boundaries with reference-input components" — claiming OnPush is either mandatory or useless both miss the nuance.',
    ['change-detection', 'onpush', 'zoneless', 'signals'],
    ['It is mandatory for signals to work', 'It disables signals', 'For fully-signal views it is nearly moot, but it still constrains non-signal/reference inputs at boundaries', 'It forces synchronous CD']),

  q('angular', 'di', 5, 'multiple-choice',
    'A token is provided in both an `EnvironmentInjector` (root) and a component\'s element-level `providers`. A directive on a deeper element injects it. Which instance wins, and why?',
    'A',
    'Angular resolves dependencies by walking the *element* (node) injector hierarchy from the requesting node upward, and only if not found there does it fall through to the *environment* injector hierarchy. So the nearer element-level provider shadows the root one for that subtree. Element injectors (components/directives) and environment injectors (root/route) are two parallel trees consulted in that order.',
    'Understanding the element-injector-then-environment-injector resolution order is what lets you intentionally shadow services per-subtree (theming, feature config) — and what explains baffling "wrong instance" bugs when a stray component-level provider shadows a root singleton.',
    ['di', 'hierarchical-injectors', 'resolution'],
    ['The element-level provider — node injectors are searched before the environment injector', 'The root provider always wins', 'It is nondeterministic', 'It throws an ambiguity error']),

  q('angular', 'signals', 5, 'multiple-choice',
    'You store a large immutable list in a signal and update it with structural sharing. Why might a custom `equal` function on the signal still be worth defining?',
    'B',
    'The default `Object.is` equality treats any new top-level reference as a change, so even a structurally-identical rebuild notifies dependents and re-runs downstream computeds. A custom `equal` (e.g. shallow/structural compare) can suppress notifications when the meaningful content is unchanged, avoiding wasted recomputation and renders. The trade-off is the cost of the equality check itself, which must be cheaper than the work it saves.',
    'Custom `equal` is a precision tool: ideal when an upstream produces new-but-equal references (server polling, normalisation) feeding expensive computeds — but a deep-equal on a huge object can cost more than the render it prevents, so measure.',
    ['signals', 'equality', 'performance'],
    ['It speeds up reads', 'It can suppress notifications for new-but-equal references, avoiding wasted recomputation', 'It is required for arrays', 'It makes the signal readonly']),

  q('angular', 'performance', 5, 'multiple-choice',
    'With incremental hydration and `@defer (hydrate on interaction)`, what does the server send and what happens on the client?',
    'C',
    'Incremental hydration lets the server render the deferred block\'s HTML (so it is visible and SEO-friendly immediately) while *deferring hydration* — the JS for that block is not loaded or wired up until the hydrate trigger (e.g. interaction) fires. Before then the static HTML is interactive only insofar as the browser handles it; Angular replays the triggering event after hydrating. This reduces initial JS execution without sacrificing first paint.',
    'Incremental hydration is the current frontier for shipping less JS: the static HTML is real and visible, hydration cost is paid lazily and event-replayed — the gotcha is that pre-hydration interactions must be designed to survive the replay correctly.',
    ['performance', 'hydration', 'defer', 'ssr'],
    ['Nothing is server-rendered; it loads on interaction', 'It fully hydrates everything upfront', 'Server renders the HTML; hydration (and its JS) is deferred until the trigger, then the event is replayed', 'It disables SSR']),

  q('angular', 'rxjs-interop', 5, 'multiple-choice',
    'When is `rxResource()` the right choice over `resource()` in Angular 22?',
    'A',
    '`rxResource()` is the RxJS-flavoured resource: its loader returns an Observable rather than a Promise, so it naturally fits sources that emit multiple values, need RxJS operators (retry/backoff, debounce, switchMap-style composition), or are already Observable-based. `resource()` expects a Promise-returning loader and is simpler for one-shot fetches. Both expose the same signal-based status/value surface.',
    'Pick `rxResource` when you genuinely need RxJS operators in the loading pipeline (streaming, complex retry); reaching for it just to call a Promise-based API wraps you in needless Observable ceremony.',
    ['rxjs-interop', 'rxresource', 'resource'],
    ['When the loader is Observable-based or needs RxJS operators (streaming, retry/backoff)', 'When you want it to be synchronous', 'It is always preferred over resource()', 'When you have no RxJS in the app']),

  q('angular', 'change-detection', 5, 'true-false',
    'In Angular 22\'s scheduler, multiple synchronous signal writes within the same task are coalesced so that dependent views refresh once, not once per write.',
    true,
    'Signal notifications mark consumers dirty, but the actual re-render is scheduled and coalesced — several writes in the same synchronous turn collapse into a single refresh on the next scheduled tick. This batching is what makes "update five signals in an event handler" cheap. It also means you cannot observe the DOM between writes within the same task.',
    'This coalescing is why imperative "read the DOM after each set" patterns fail — the render has not happened yet; use `afterNextRender` to act once after the batched update lands.',
    ['change-detection', 'scheduler', 'coalescing']),

  q('angular', 'forms', 5, 'multiple-choice',
    'You build a dynamic Signal Form whose set of controls changes at runtime (add/remove line items). What is the principal-level concern when wiring validators across this dynamic structure?',
    'B',
    'Dynamic control sets mean validators (especially cross-field/group ones) must be derived reactively from the current structure, not captured once at build time — otherwise a validator references stale controls after add/remove. With Signal Forms, the form\'s shape and its validity are signals, so the cross-field rules should be expressed as computations over the live control collection. The subtle bug is closing over a removed control and validating against ghost state.',
    'Treat the form structure itself as reactive state: derive aggregate validators from the live controls signal so add/remove automatically re-wires them, rather than imperatively attaching/detaching validators and risking stale references.',
    ['forms', 'signal-forms', 'dynamic'],
    ['There is no concern; validators auto-update', 'Validators must derive from the live control collection, or they reference stale/removed controls', 'You must switch to ReactiveFormsModule', 'Dynamic forms are impossible with signals']),

  q('angular', 'di', 5, 'multiple-choice',
    'Why can injecting a service that itself calls `inject()` in a field initialiser work when constructed by DI, but fail if you `new` it manually?',
    'C',
    'The `inject()` function resolves against the *currently active injection context*, which Angular establishes while it instantiates a class through the injector. Manually `new`-ing the class runs the field initialisers with no active context, so `inject()` has no injector and throws. This is why DI-managed classes must be created by Angular, not by hand (outside `runInInjectionContext`).',
    'This is the root cause behind "inject() must be called from an injection context" when someone instantiates a service directly in a test or factory — the fix is to let TestBed/injector create it, or wrap construction in `runInInjectionContext`.',
    ['di', 'injection-context', 'inject'],
    ['Manual `new` is faster so it skips DI', 'Field initialisers never run on `new`', '`inject()` needs an active injection context, which only exists when Angular instantiates the class', 'It always fails either way']),

  q('angular', 'performance', 5, 'multiple-choice',
    'A principal engineer argues that adding `@defer (on viewport)` around an already-small, above-the-fold component can *hurt* the user. Why might they be right?',
    'A',
    'Deferring an above-the-fold component splits it into a separate chunk that must be fetched and rendered after initial load, introducing a placeholder→content swap (layout shift / flash) for content the user sees immediately — with little bundle saving if the component was already small. `@defer` pays off for heavy, below-the-fold, or conditionally-needed content; misapplied, it adds latency and CLS for no benefit.',
    'The mature view is that `@defer` is a targeted tool, not a default: deferring cheap, immediately-visible content trades a real UX cost (flash, CLS, extra request) for a negligible bundle win — measure LCP/CLS before and after.',
    ['performance', 'defer', 'cls'],
    ['It adds a fetch + placeholder swap (latency/CLS) for content the user sees immediately, with little bundle saving', 'It disables SSR', 'It breaks change detection', 'It always improves performance']),

  q('angular', 'control-flow', 5, 'true-false',
    'Built-in `@for`/`@if` are compiled into instruction calls in the component\'s template function, which is part of why they are faster and more tree-shakable than the equivalent `*ngFor`/`*ngIf` structural directives.',
    true,
    'Built-in control flow is handled by the Angular compiler as dedicated template instructions rather than by instantiating directive classes with embedded views and `CommonModule` machinery. This removes directive instantiation overhead, lets the compiler optimise the loop/branch directly, and avoids shipping the structural-directive code. It is both a runtime and a bundle-size win.',
    'The deeper point is that built-in control flow moved branching/iteration from a runtime-directive concern into the compiler, which is what unlocks future optimisations (and is why the team could deprecate the structural-directive path for new apps).',
    ['control-flow', 'compiler', 'performance']),

  q('angular', 'testing', 5, 'multiple-choice',
    'In a zoneless app, an `effect()` that you want to assert on does not appear to have run mid-test. What is the principled way to make it run deterministically?',
    'B',
    'Effects are scheduled, not synchronous, so in a test you must flush the scheduler — `TestBed.tick()` (or `flushEffects()` / `applicationRef.tick()`, depending on API) forces pending effects/CD to run deterministically. Relying on real timers or `fakeAsync` is fragile in zoneless because there is no zone to coordinate. Reading the effect\'s side effect immediately after `set()` without flushing observes pre-flush state.',
    'The reliable pattern is "mutate signal → flush via TestBed → assert"; sprinkling `await fixture.whenStable()` or `setTimeout` to "wait for the effect" is the flaky alternative principal reviewers should reject.',
    ['testing', 'effect', 'zoneless'],
    ['Wrap in fakeAsync and tick(0)', 'Flush the scheduler via TestBed.tick()/flushEffects() then assert', 'Use a real setTimeout', 'Effects cannot be tested']),

  q('typescript', 'typescript-advanced', 5, 'multiple-choice',
    'Why does this assignment fail under `strictFunctionTypes`?\n```ts\ntype Handler<T> = (x: T) => void;\nlet animal: Handler<{ name: string }>;\nlet dog: Handler<{ name: string; breed: string }>;\nanimal = dog; // error\n```',
    'A',
    'Function *parameters* are compared contravariantly under `strictFunctionTypes`: a `Handler<{name}>` may be called with just `{name}`, but `dog` expects to also read `.breed`, which would be missing — so assigning `dog` to `animal` is unsound and rejected. Assigning the other way (`dog = animal`) is allowed, since a handler that needs less can stand in where more is provided. (Method parameters are an intentional bivariant exception.)',
    'Parameter contravariance is why "more specific callback" is NOT assignable to "more general callback slot" — a frequent surprise when typing event/handler maps; the bivariance loophole for methods is a deliberate ergonomic compromise, not a guarantee.',
    ['typescript-advanced', 'variance', 'contravariance'],
    ['Parameters are contravariant; `dog` needs `.breed` that the caller of `animal` will not supply', 'Functions are always invariant', 'It is a compiler bug', '`void` return types are incompatible']),

  q('typescript', 'typescript-advanced', 5, 'multiple-choice',
    'What problem do "branded" (nominal) types like `type UserId = string & { readonly __brand: unique symbol }` solve?',
    'C',
    'TypeScript is structurally typed, so a plain `UserId = string` is interchangeable with any other `string`, letting you accidentally pass an `OrderId` where a `UserId` is expected. Branding intersects the primitive with a unique, unconstructable marker so the two are no longer assignable to each other, simulating nominal typing. The brand exists only at the type level — at runtime it is still a string.',
    'Branded types catch a whole class of "right primitive, wrong meaning" bugs (mixing ids, raw vs sanitised strings) at compile time with zero runtime cost — the price is small ceremony at the boundaries where you mint the branded value.',
    ['typescript-advanced', 'branded-types', 'nominal'],
    ['They add runtime validation', 'They make strings faster', 'They simulate nominal typing so distinct id-like strings are not interchangeable', 'They are required for generics']),

  q('javascript', 'closures', 5, 'multiple-choice',
    'What does this log, and why?\n```js\nfunction* gen() {\n  const x = yield 1;\n  const y = yield x + 1;\n  return x + y;\n}\nconst it = gen();\nconsole.log(it.next().value);\nconsole.log(it.next(10).value);\nconsole.log(it.next(20).value);\n```',
    'B',
    'A generator suspends at each `yield`, and the value passed to the *next* `next(v)` becomes the result of the paused `yield` expression. First `next()` runs to `yield 1` → logs `1` (the arg is ignored). `next(10)` resumes with `x = 10`, runs to `yield x + 1` → logs `11`. `next(20)` resumes with `y = 20`, returns `x + y = 30` → logs `30`.',
    'This two-way communication (yield emits out, next() injects in) is the basis of coroutine patterns and how async/await is conceptually implemented over generators — understanding it demystifies a lot of "magical" control-flow libraries.',
    ['closures', 'generators', 'coroutines'],
    ['`1`, `2`, `30`', '`1`, `11`, `30`', '`1`, `11`, `31`', '`undefined`, `11`, `30`']),

  q('web', 'browser-apis', 5, 'multiple-choice',
    'A principal engineer says "moving work to a Web Worker won\'t speed up your DOM-heavy rendering". Why is that broadly correct?',
    'A',
    'Web Workers run on separate threads but have *no access to the DOM* — only the main thread can touch the DOM. So worker offloading helps with pure CPU work (parsing, crypto, data crunching) by keeping the main thread free, but the actual layout/paint/DOM mutation still happens on the main thread and cannot be parallelised this way. DOM-bound bottlenecks need different fixes (virtualisation, fewer nodes, batching).',
    'The senior framing is "workers parallelise computation, not rendering" — offload the data prep that was blocking the main thread, but a slow render is solved by doing less DOM work (virtual scroll, defer, OnPush/signals), not by spawning threads.',
    ['browser-apis', 'web-worker', 'rendering'],
    ['Workers have no DOM access; only the main thread renders, so DOM work cannot be offloaded', 'Workers are slower than the main thread', 'Workers can only run once', 'Workers cannot do CPU work']),

  // __INSERT__
];

// --- Validate composition before writing -----------------------------------
function assert(cond, msg) {
  if (!cond) {
    console.error('✗ ' + msg);
    process.exitCode = 1;
  }
}

const byCat = {};
const byDiff = {};
const bySub = {};
let withCode = 0;
for (const item of QUESTIONS) {
  byCat[item.category] = (byCat[item.category] ?? 0) + 1;
  byDiff[item.difficulty] = (byDiff[item.difficulty] ?? 0) + 1;
  bySub[item.subcategory] = (bySub[item.subcategory] ?? 0) + 1;
  if (item.question.includes('```')) withCode += 1;
}

assert(QUESTIONS.length === 110, `expected 110 questions, got ${QUESTIONS.length}`);
assert((byCat.angular ?? 0) >= 80, `angular ≥80, got ${byCat.angular ?? 0}`);
assert(((byCat.javascript ?? 0) + (byCat.typescript ?? 0)) >= 15, `js+ts ≥15, got ${(byCat.javascript ?? 0) + (byCat.typescript ?? 0)}`);
assert((byCat.web ?? 0) >= 10, `web ≥10, got ${byCat.web ?? 0}`);
assert(withCode >= 5, `≥5 code-snippet questions, got ${withCode}`);
assert((byDiff[1] ?? 0) === 8, `L1 must be 8, got ${byDiff[1] ?? 0}`);
assert((byDiff[2] ?? 0) === 18, `L2 must be 18, got ${byDiff[2] ?? 0}`);
assert((byDiff[3] ?? 0) === 35, `L3 must be 35, got ${byDiff[3] ?? 0}`);
assert((byDiff[4] ?? 0) === 34, `L4 must be 34, got ${byDiff[4] ?? 0}`);
assert((byDiff[5] ?? 0) === 15, `L5 must be 15, got ${byDiff[5] ?? 0}`);

const ids = new Set(QUESTIONS.map((x) => x.id));
assert(ids.size === QUESTIONS.length, 'duplicate question ids detected');

const outDir = resolve(__dirname, '../src/data');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'questions.json'), JSON.stringify(QUESTIONS, null, 2) + '\n');

console.log(`✓ wrote ${QUESTIONS.length} questions`);
console.log('  by category :', byCat);
console.log('  by difficulty:', byDiff);
console.log(`  code snippets: ${withCode}, subcategories: ${Object.keys(bySub).length}`);
