# Architecture

Blue Eclipse is a standalone, **zoneless**, signals-first Angular 22 SPA. There
are **no NgModules** anywhere — bootstrap is `bootstrapApplication` with a flat
provider list. State is held in signals; async data flows through
`resource()` / `rxResource()`; there is no NgRx and no `BehaviorSubject` for UI
state.

## Layered structure

```
src/
  app/
    core/                      # framework-agnostic domain + services (singletons)
      models/                  # Question / TestSession / TestResult types
      services/                # quiz · anthropic · storage · theme
      tokens/                  # InjectionTokens (STORAGE, WINDOW, ANTHROPIC_CONFIG)
    features/                  # one lazy-loaded route per folder
      dashboard · test · results · browse · settings
    shared/                    # reusable, presentational pieces
      components/              # difficulty-dots · progress-bar · toast · code-block
      forms/                   # signal-forms toolkit
      pipes/                   # relative-time
      markdown.ts              # marked configuration
  data/questions.json          # the 110-question bank (generated + validated)
  styles/                      # Blue Eclipse token system + reset/typography/animations
  environments/                # build-time config (model id, API url)
```

**Dependency direction:** `features → shared → core`. Core never imports from
features. The one pragmatic exception is `QuizService` importing `ToastService`
(for the adaptive “level up” nudge), which lives under `shared` as a root
singleton.

## State & reactivity

- **Signals everywhere.** `QuizService` holds the live session as signals
  (`currentIndex`, `answers`, `orderedQuestions`) and exposes `computed`
  selectors (`current`, `isAnswered`, `isLastQuestion`).
- **`linkedSignal`** drives the selected-but-uncommitted answer in the Test
  screen — it resets to `null` whenever `currentIndex` changes, which is exactly
  the “reset derived state on source change” use case `linkedSignal` exists for.
- **`resource`/`rxResource`.** The question bank loads via `rxResource` over
  `HttpClient` (fetch backend). Consumers read `bank.value()` reactively.
- **`effect` + `untracked`.** The Test screen uses an `effect` keyed on
  `currentIndex` to (re)start the per-question timer, reading config with
  `untracked` so the effect only re-runs on question change.
- **Zoneless CD.** `provideZonelessChangeDetection()` means every UI input must
  be a signal. The timer uses `setInterval` but writes a `remaining` **signal**,
  so the view updates without Zone.js. The same discipline governs the AI stream
  (appends to a `text` signal) and toasts.

## Pure, testable core

The test-generation algorithm is a set of **pure functions** exported from
`quiz.service.ts` (`composeTest`, `filterPool`, `shuffle`, `isCorrect`) that take
an injectable RNG. This keeps the composition rules (≥75% Angular for
“Angular focus”, mandatory signals/change-detection/forms, difficulty-ascending
order, weighted-random within bands) unit-testable without a TestBed —
see `quiz.service.spec.ts`.

`AnthropicService.stream()` is an async generator that parses the SSE wire format
and yields text deltas; `anthropic.service.spec.ts` drives it with a fake
`ReadableStream` and asserts delta concatenation plus error mapping
(no-key / auth / rate-limit / aborted).

## Signal Forms

`shared/forms/signal-forms.ts` is a compact local implementation of the Angular
22 Signal Forms shape — `signalControl()`, `signalForm()`, `withValidators()`,
sync + async validators, and cross-field group validators. Validity, errors and
value are all signals, so templates bind `control.errors()` directly with no
async pipe. The Dashboard config form, Browse multi-select filters, and Settings
inputs all use it. It is deliberately swappable for the framework API.

## Rendering & assets

- **Markdown** (question stems, explanations, streamed AI output) renders through
  a single `marked` configuration; `CodeBlockComponent` wraps it and re-renders
  reactively from its `markdown` signal input — ideal for character-by-character
  streaming.
- **Charts are pure SVG** — the results donut and the timer ring are hand-built
  with `stroke-dasharray`/`stroke-dashoffset` computed signals. No Chart.js.
- **Virtual scroll** (CDK) backs the Browse list so all 110 rows render with a
  constant DOM-node count.
- **Icons** use `lucide-angular` via the `[img]` data-binding form (no global
  registry), which keeps imports explicit and tree-shakable.

## Routing

Every feature is `loadComponent`-lazy. The router enables
`withViewTransitions()` (CSS `::view-transition` cross-fade in
`_animations.scss`), `withComponentInputBinding()` (the `:testId` route param
binds straight to the `Results` component’s `input`), and `PreloadAllModules`.

## Theming

`ThemeService` keeps the preference (`light` | `dark` | `system`) as a signal,
resolves the effective theme via a `computed` over a `matchMedia` signal, and an
`effect` mirrors it onto `<html data-theme>` and persists it. All colour comes
from CSS custom properties defined in `styles/_tokens.scss`.

## Persistence

`StorageService` is a typed `localStorage` wrapper (generic JSON read/write,
namespaced `be:` keys, defensive against quota/private-mode failures). It backs
test history (last 25 results), the API key, theme, and the default timer.
“Reset all data” clears only the `be:`-prefixed keys.
