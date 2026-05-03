---
title: Deepen TabState's viewport responsibility into a TabViewport class
status: done
created: 2026-05-03
---

## Problem

`TabState` (introduced in [077](077-deepen-editor-state-architecture.md)) carries six viewport-related methods — `setViewport`, `zoomIn`, `zoomOut`, `zoomReset`, `zoomFit`, `toggleGrid` — that all repeat the same boilerplate:

```text
this.viewport = this.#backend.viewportOps.X(
  this.viewport,
  this.pixelCanvas.width, this.pixelCanvas.height,
  this.viewportSize.width, this.viewportSize.height,
  ...
);
this.#notifier.markDirty(this.documentId);
```

`ViewportOps` is a free-function interface over plain `ViewportData`, which is the right shape for cross-shell sharing and serialization, but it pushes the orchestration cost onto every caller. `TabState` ends up reassembling "current viewport + canvas dimensions + viewport size" on each call and is responsible for clamping and dirty notification afterwards. The methods earn their keep — deleting them would scatter the same boilerplate to every component that wants to zoom — but the interface is nearly as complex as the implementation, and `TabState` itself acquires a layer of friction that has nothing to do with the *tab* concept.

The same pattern repeats inside `TabState.resize` and inside `#applyEffects`'s `canvasReplaced` case: when the canvas dimensions change, `viewport = viewportOps.clampPan(...)` must be re-applied. This is a third site that knows the viewport-clamping rule, and there is no structural protection against forgetting it on a future canvas-replacing path.

Net result: the viewport concept is half-encapsulated. `ViewportData` is data, `ViewportOps` is operations, but the *stateful binding* between a tab and its viewport — including its dependence on the current canvas dimensions and viewport size — is open code spread across `TabState`.

## Proposed Interface

A new `TabViewport` class owns `ViewportData` and `ViewportSize` for one tab, reads canvas dimensions through an injected reactive getter (so a canvas resize is tracked automatically), exposes the six existing intent methods plus an explicit `reclamp()`, and emits `markDirty` itself. `TabState` keeps its current public surface (every existing method name and signature stays) but delegates each viewport method to the inner `TabViewport`.

### Construction

```text
new TabViewport({
  initial: ViewportData,
  initialViewportSize: ViewportSize,
  getCanvasDimensions: () => { width: number; height: number },
  viewportOps: ViewportOps,
  notifier: DirtyNotifier,
  documentId: string,
})
```

`getCanvasDimensions` is a Svelte 5 reactive getter — `TabViewport` calls it on every read inside its methods, so the value is always live without an explicit "canvas resized" notification.

### Public surface

- `get viewport(): ViewportData` — current state (Svelte 5 `$state`-backed)
- `get viewportSize(): ViewportSize`
- `setViewportSize(size: ViewportSize): void` — called by the existing DOM-measurement code path
- `apply(vd: ViewportData): void` — gestures' "viewport already computed, apply it" entry point (renamed from `setViewport` for clarity; see Out of Scope re: rename scope)
- `zoomIn(): void` / `zoomOut(): void` / `zoomReset(): void`
- `zoomFit(maxZoom?: number): void`
- `toggleGrid(): void`
- `reclamp(): void` — re-runs `clampPan` against the current canvas dimensions; called from `TabState.resize` and the `canvasReplaced` effect path

Every mutating method ends with `notifier.markDirty(documentId)`. There is no boolean return path that callers must check.

### What the interface hides

- The `viewportOps.X(viewport, canvasW, canvasH, viewportSizeW, viewportSizeH, ...)` argument-assembly pattern
- `markDirty` fan-out from viewport mutations
- The clamping rule that ties viewport pan to canvas dimensions
- The dual-channel state (current `viewport` + current `viewportSize`) and how they combine

### What stays the same

- `ViewportData` remains a plain interface (snapshot/persistence shape unchanged)
- `ViewportOps` remains a free-function interface over plain data (cross-shell shape unchanged — Apple-shell swap point preserved)
- `TabState` public surface is unchanged: every existing caller (EditorController, components, gestures) sees the same methods on `tab` as before
- 077's `editor-session/` cluster placement and dependency-injection style

## Implementation Plan

Three commits, all on a work branch. Each commit must pass `bun run check` + `bun run test` + `cargo test`.

### Commit 1 — `feat: introduce TabViewport + tests`

Additive only; no consumer changes.

New files:

- `src/lib/canvas/editor-session/tab-viewport.svelte.ts` — the `TabViewport` class as specified above. `viewport` and `viewportSize` are `$state`-backed; the class holds `viewportOps`, `notifier`, `documentId`, and `getCanvasDimensions` privately.
- `src/lib/canvas/editor-session/tab-viewport.svelte.test.ts` — unit tests using the production `wasmBackend.viewportOps` + `createFakeDirtyNotifier()` + a `$state`-backed canvas-dimensions object whose mutations the test drives directly.

Test behaviors (each behavior = one test):

- `apply` writes the supplied viewport and emits `markDirty`
- `zoomIn` / `zoomOut` step through `viewportOps.nextZoomLevel` / `prevZoomLevel`, centered on the current viewportSize
- `zoomReset` returns zoom to 1.0 centered on the current viewportSize
- `zoomFit` respects `maxZoom`
- `toggleGrid` flips `viewport.showGrid` and emits `markDirty`
- `reclamp` re-applies `clampPan` against the *current* canvas dimensions read through the injected getter — verify by mutating the dimensions object after construction and asserting the post-reclamp pan
- Every mutating method emits exactly one `markDirty(documentId)` per call
- `setViewportSize` updates `viewportSize` and emits `markDirty`

### Commit 2 — `refactor: delegate TabState viewport responsibility to TabViewport`

Atomic switch — `TabState` constructs a `TabViewport` and delegates.

Modifications to `src/lib/canvas/editor-session/tab-state.svelte.ts`:

- Construct `#tabViewport = new TabViewport({ initial: <fitted>, initialViewportSize: DEFAULT_VIEWPORT_SIZE, getCanvasDimensions: () => ({ width: this.pixelCanvas.width, height: this.pixelCanvas.height }), viewportOps: this.#backend.viewportOps, notifier: deps.notifier, documentId: deps.documentId })` after `pixelCanvas` is assigned.
- Replace the `viewport`/`viewportSize` `$state` fields with getters that project through `#tabViewport`.
- `setViewport` → `apply` delegate; `zoomIn/Out/Reset/Fit`, `toggleGrid` → direct delegates with no body changes at call sites.
- `resize`: after the canvas swap, call `this.#tabViewport.reclamp()` instead of inline `clampPan`.
- `#applyEffects` `canvasReplaced` case: after `this.pixelCanvas = effect.canvas`, call `this.#tabViewport.reclamp()` instead of inline `clampPan`.
- The DOM-measurement code that today writes `tab.viewportSize = ...` now calls `tab.setViewportSize(...)` (one-line shape change at the consuming component; this is the only consumer-visible change in this commit).

`tab-state.svelte.test.ts` updates: viewport-method tests continue to assert through `tab.viewport`; one new test asserts that a canvas-dimension change made externally is observed by the next viewport read (sanity check on the reactive getter wiring).

Update `src/routes/editor/+page.svelte` (or wherever `viewportSize` is currently assigned from a `bind:clientWidth`/`bind:clientHeight` pattern) to call the new setter.

### Commit 3 — `refactor: rename TabState.setViewport → apply for the viewport entry point`

Optional polishing commit — rename the gestures' raw entry from `setViewport` to `apply` for parity with `TabViewport`. Touches gesture-handling and EditorController's `handleViewportChange`. Skip this commit if the rename causes more churn than it saves; the functional change is complete after Commit 2.

## Decision Record

Decisions made during the grilling that produced this plan:

1. **External state via reactive getter (Pull, not Push).** `TabViewport` reads canvas dimensions and viewportSize through getters injected at construction, matching the pattern already established by `ToolRunner.host`, `StrokeEngine.host`, and `SamplingSession.getSamplingPort`. Push-style `notifyCanvasResized` rejected: it duplicates the synchronization promise across two sites and a missed call would silently leave the viewport stale.
2. **Six intent methods, not a finer-grained gesture decomposition.** `apply(vd)` is kept as a legitimate entry point (gestures compute their own next-viewport from pinch / wheel / drag math). Decomposing it into `pan`, `pinchZoomAtPoint`, `wheelZoomAtPoint` would inflate the interface for hypothetical leverage — premature abstraction.
3. **TabViewport owns markDirty.** The class holds `notifier` + `documentId` directly, mirroring the `References` class pattern. Boolean-return / external-dispatch alternatives push boilerplate back to callers and defeat the point of the deepening.
4. **Explicit `reclamp()` instead of a reactive `$effect`.** Canvas dimensions change at exactly two well-known sites (`TabState.resize`, the `canvasReplaced` effect). Naming the trigger keeps the call synchronous (the next viewport read is fresh) and the lifecycle visible. A class-internal `$effect.root` would queue the clamp asynchronously and add `Svelte 5` lifecycle bookkeeping that the project does not otherwise need.
5. **`TabState` public surface unchanged.** No EditorController or component changes beyond the one `setViewportSize` setter swap. Keeping the surface stable scopes blast radius to `editor-session/`.
6. **No new ADR.** The reactive-getter pattern is already implicit in three existing modules; the explicit-reclamp choice is small enough to live in this issue's record. Reopen if it becomes a recurring topic.

## Testing Decisions

- `TabViewport` gets a focused suite (Commit 1) that asserts each intent method's outcome and the `reclamp` reactive-read contract. Production `wasmBackend.viewportOps` is used directly — happy-dom + WASM is the established pattern from 077.
- `TabState` viewport tests in `tab-state.svelte.test.ts` continue to read through `tab.viewport`; they assert *outcomes*, not which inner object the value comes from, so they survive Commit 2 with at most trivial setup updates.
- No new E2E. The refactor preserves observable behavior; existing Playwright zoom/grid coverage exercises the integration.

## Out of Scope

- **EditorController facade re-evaluation.** A separate candidate (TabState/Workspace exposed directly to components, keyboard-only logic kept on the controller) is its own issue and partially reopens 077's decision 11. Not addressed here.
- **`ViewportOps` interface change.** The free-function shape is preserved — Rust-core / Apple-shell swap point intact.
- **Gesture decomposition into `pan` / `pinchZoomAtPoint` / `wheelZoomAtPoint`.** Not introduced.
- **Reactive `$effect`-based reclamp.** Considered and rejected (see Decision Record #4).
- **Apple shell viewport layer.** This deepening is web-shell only; UniFFI Apple bindings are unaffected.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/tab-viewport.svelte.ts` | New. `TabViewport` class owns `ViewportData` + `ViewportSize`, reads canvas dimensions through an injected reactive getter, hides the `clampPan` rule, and emits `markDirty` itself. Public surface: `viewport`/`viewportSize` getters, `apply`, `setViewportSize`, `zoomIn`/`zoomOut`/`zoomReset`/`zoomFit`, `toggleGrid`, `reclamp`. Private `#zoomCenteredTo` centralizes the centered-zoom helper. |
| `src/lib/canvas/editor-session/tab-viewport.svelte.test.ts` | New. 9 tests covering the public surface using production `wasmBackend.viewportOps` + `createFakeDirtyNotifier()`. The `reclamp` test mutates a plain `dimensions = { width, height }` object between construction and call to verify the reactive-getter wiring. The `markDirty` fan-out test asserts every mutating method emits exactly one `markDirty(documentId)` per call. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `viewport` and `viewportSize` `$state` fields replaced with getters that project through `#tabViewport`. Constructor builds the initial fitted viewport (with optional `gridColor` override) and constructs `TabViewport` with `getCanvasDimensions: () => ({ width: self.pixelCanvas.width, height: self.pixelCanvas.height })`. All viewport intent methods (`zoomIn/Out/Reset/Fit`, `toggleGrid`) now delegate. New `setViewportSize` method added. `setViewport` retains the explicit `clampPan` call as a safety net for raw gesture inputs before delegating to `#tabViewport.apply`. `resize` and the `canvasReplaced` effect path call `this.#tabViewport.reclamp()` instead of inline `clampPan`. |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | Adds `'canvas resize triggers viewport reclamp against the new canvas dimensions'` — a sanity check on the reactive-getter wiring at the integration level (resize → reclamp → idempotent clampPan match). |
| `src/lib/canvas/editor-session/workspace.svelte.test.ts` | One `tab.viewport = …` direct assignment swapped for `tab.setViewport(…)` (TabState.viewport is now a getter). Snapshot-equality assertion adjusted to compare `snapshot.viewport === workspace.activeTab.viewport` rather than direct `panX` numbers, since `clampPan` may transform the input. |
| `src/lib/session/session.test.ts` | One `editor.workspace.activeTab.viewport = … satisfies ViewportData` direct assignment swapped for `editor.workspace.activeTab.setViewport(… satisfies ViewportData)`. Resolves a read-only-property type error and 3 cascade timeout failures with one fix. |
| `src/routes/editor/+page.svelte` | DOM-measurement code (`bind:clientWidth`/`bind:clientHeight` consumer in `initTabViewport`) now calls `tab.setViewportSize({ width, height })` instead of assigning `tab.viewportSize` directly. |

### Key Decisions

- **Commit 3 (rename `TabState.setViewport` → `apply`) skipped.** `TabState.setViewport` keeps an explicit `clampPan` call as a safety net before delegating, while `TabViewport.apply` writes the supplied viewport directly per the issue spec. Renaming would create *same name, different semantics* anti-parity across the two layers. Functional deepening is complete after Commit 2; the rename was always optional in the plan.
- **Reactive-getter for canvas dimensions, not push notifications.** Matches the existing pattern from `ToolRunner.host`, `StrokeEngine.host`, `SamplingSession.getSamplingPort`. Verified end-to-end by the `tab-state` reactive-getter test.
- **`TabViewport` owns `markDirty` directly.** Holds `notifier` + `documentId` privately, mirroring the `References` pattern from 084. Boolean-return / external-dispatch alternatives push boilerplate back to callers.

### Notes

- 2 commits (planned 3, Commit 3 skipped): `feat: introduce TabViewport + tests` (additive) → `refactor: delegate TabState viewport responsibility to TabViewport` (atomic switch).
- `bun run check` 0 errors, `bun run test` 846 passing (net +10: 9 new `TabViewport` tests + 1 new `TabState` reactive-getter test), `cargo test` green at every commit.
- Direct field assignments (`tab.viewport = …`, `tab.viewportSize = …`) in two test files and one route page were converted to setter calls as part of Commit 2's atomic switch — this is the only consumer-visible change beyond the `editor-session/` cluster, exactly as the plan projected.
