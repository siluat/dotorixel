---
title: Deepen editor state — split god object into layered TabState / Workspace / EditorController with ports
status: open
created: 2026-04-22
---

## Problem

`EditorState` has become a 368-line god object that conflates two ownership levels behind a single identifier. The class holds genuinely per-tab state (canvas, viewport, history, resize anchor, render version, document id, sampling session) and also re-exposes workspace-shared state (active tool, foreground/background colors, pixel-perfect flag, recent colors) as indistinguishable getter/setter proxies. The nine-parameter constructor and a lazy two-step init dance (keyboard ref injected after construction) compound the shallowness: the interface is almost as complex as the implementation.

The coupled cluster spans four modules that together define "what the editor is":

- A top-level state class owning per-tab reactive fields and proxy accessors to a shared sibling (~368 LOC)
- A workspace container that owns tabs, active tab index, and a single shared-state instance (~134 LOC)
- A tiny shared-state holder (~10 LOC) consumed through proxies above
- A persistence layer (session orchestrator, persistence adapter, auto-save debouncer) that reaches into workspace internals and fans dirty notifications across many call sites

The friction this causes is not hypothetical:

- A reader of `editor.foregroundColor` cannot tell from the call site whether the value is tab-local or workspace-shared. The distinction matters for correctness (session persistence, test scope, future per-tab tool overrides) but is invisible.
- The god object cannot be unit-tested in pieces. Today's tests either exercise the whole thing (requiring real WASM types) or reach past the public surface to assert internal state.
- The boundary between "state" and "UI-facing behavior" (keyboard handling, tool-runner wiring, stroke dispatch) is diffused across the class, so adding a new UI affordance or a new tab-level concept (e.g., per-document settings, layer stack) requires touching the same file that every unrelated read already touches.
- The persistence seam is implicit: `AutoSave.markDirty` and `notifyTabRemoved` are threaded through whatever call site happens to mutate state. A dropped call is a silent save-loss bug.

These are the characteristic symptoms of a shallow-module cluster that deserves a single deeper module — one interface, layered ownership inside.

## Proposed Interface

Three layers with distinct responsibilities, connected through two explicit ports. The two smallest layers have no framework dependencies and are trivially instantiable in tests; the third layer is the Svelte-facing facade that UI templates bind to.

### Layer 1: `TabState` — pure per-tab state

Owns everything that belongs to a single document: canvas, viewport and viewport size, history manager, render version, resize anchor, export UI flag, document id, name, sampling session, and a tab-scoped `ToolRunner`. Holds read-only references to ambient dependencies (shared state, keyboard callbacks, dirty notifier) so drawing handlers internal to the tab can dispatch effects correctly, but never mutates sibling tabs or workspace-level collections. Constructed from a small `TabStateDeps` bag plus an injected `CanvasBackend`; the typical producer is `Workspace.createTab`, but the public constructor is exposed so tests can instantiate a tab in isolation with fake ports. Exposes reactive fields via Svelte 5 `$state` class fields, `$derived` for local derivations (`zoomPercent`), imperative drawing handlers (`drawStart`, `draw`, `drawEnd`, `undo`, `redo`, `clear`), and `toSnapshot`. Auto-emits `DirtyNotifier.markDirty(this.documentId)` on every persistable mutation.

### Layer 2: `Workspace` — tabs, shared state, dirty notifications

Owns a single `SharedState` instance, the `TabState[]` array plus the active index, the `CanvasBackend` / `DirtyNotifier` ports, and a keyboard reference bag (a `{ getShiftHeld(): boolean }` structural type — not the full `KeyboardInput`). All tabs see the same `SharedState` by reference — mutating `workspace.shared.activeTool` is immediately reflected everywhere because there is one source of truth, not a proxy chain. Exposes `createTab` as the canonical tab producer (bakes in ambient deps), `addTab`, `closeTab`, `setActiveTab`, `openDocument`, `toSnapshot`. Auto-emits dirty notifications on shared-state setters and tab lifecycle events. No UI concerns; no keyboard ownership; no tool-runner wiring.

### Layer 3: `EditorController` — UI facade, keyboard, tool-runner wiring

The object Svelte templates bind to. Holds a `Workspace` and a `KeyboardInput` (owns the keyboard lifecycle). Exposes:

- **Handlers**: `handleDrawStart`, `handleDraw`, `handleDrawEnd`, `handleSampleStart/Update/End`, `handleUndo/Redo/Clear`, `handleViewportChange`, `handleZoomIn/Out/Reset/Fit`, `handleResize`, `handleExportPng`, `handleKeyDown/Up/Blur`, `toggleExportUI`, `swapColors`. These are the arrow methods templates bind to; most delegate to `workspace.activeTab` or `keyboard`.
- **Setter methods**: `setTool`, `setForegroundColor`, `setBackgroundColor`, `togglePixelPerfect`. Writes are explicit and auditable.
- **Convenience getters for the most-bound UI reads**: `activeTool`, `foregroundColor`, `backgroundColor`, `foregroundColorHex`, `backgroundColorHex`, `pixelPerfect`, `recentColors`, `toolCursor` (shared-state projections); `canUndo`, `canRedo`, `zoomPercent`, `renderVersion`, `pixelCanvas`, `viewport`, `viewportSize`, `resizeAnchor`, `isExportUIOpen`, `samplingSession` (active-tab projections); `isSpaceHeld`, `isShiftHeld`, `isShortcutHintsVisible` (keyboard projections). Implemented as plain getter proxies — Svelte 5 `$state` auto-reactivity propagates through them.
- **Explicit escape hatches**: `editor.workspace.shared.X`, `editor.workspace.activeTab.X`, and `editor.keyboard.X` remain available for code that genuinely needs ownership-aware access — persistence restore, debug inspection, tests that assert ownership semantics, and keyboard-aware gesture handlers.

The convenience layer exists only on `EditorController`, not on `Workspace` or `TabState`. This keeps templates terse (`editor.activeTool`) while preserving the full structural layering underneath.

### Usage examples

**Svelte template**. Templates keep the short-form reads they have today for the common path, and gain explicit setter methods for writes:

```svelte
<script lang="ts">
  let { editor }: { editor: EditorController } = $props();
</script>

<ToolButton
  active={editor.activeTool === 'pencil'}
  onclick={() => editor.setTool('pencil')} />
<button disabled={!editor.canUndo} onclick={editor.handleUndo}>Undo</button>
<ColorSwatch hex={editor.foregroundColorHex} />
```

**Composition root**. `createEditorController(deps)` assembles the entire object graph with a lazy-closure pattern that resolves the keyboard ↔ tool-runner circular reference without a two-step init:

```ts
const editor = createEditorController({
  backend: wasmBackend,
  notifier: autoSaveDirtyNotifier,
  initialDocument: /* ... */,
});
```

Internally, `createEditorController` forward-declares `workspace`, constructs `keyboard` with a host whose callbacks close over the (eventually assigned) `workspace`, then constructs `workspace` with a `{ getShiftHeld: () => keyboard.isShiftHeld }` callback, and finally wraps both in `EditorController`. Callbacks fire only in response to events, so no ordering issue surfaces.

**Tool-runner stroke dispatch**. `ToolRunner` lives inside `TabState` (per-tab). Its host reads `pixelCanvas` from the owning `TabState` and `foregroundColor`/`backgroundColor`/`pixelPerfect` from the `SharedState` reference injected at construction. The existing `SessionHost` capture pattern is unchanged — it continues to snapshot stroke-start values into each stroke session.

**Session persistence**. The composition root wires the `DirtyNotifier` port to the `AutoSave` instance and passes it to `Workspace` (which in turn injects it into each `TabState`). Every mutation `TabState` and `Workspace` perform invokes the port; no caller outside the session layers threads dirty notifications manually. Save and restore operate on `Workspace.toSnapshot()` / a restore path driven by `createEditorController({ restored })`.

**Unit test**. Each layer is instantiable alone with a pure-TypeScript `CanvasBackend` fake and an array-capture `DirtyNotifier` fake. A test can construct a `TabState` to assert undo-across-resize, a `Workspace` to assert that `shared.activeTool` propagates and that `closeTab` notifies the port, or an `EditorController` with a fake workspace to assert handler dispatch — without instantiating the others and without WASM.

### What the interface hides

- The distinction between tab-local and workspace-shared state at the call site — readers write `editor.activeTool` for the common case and `editor.workspace.shared.X` when ownership matters.
- Svelte 5 `$state` internals and the `renderVersion` bookkeeping (bumped internally by `applyCanvasChanged`, never by callers).
- The per-tab `HistoryManager` lifecycle and the circular init between keyboard input and tool runner (resolved inside `createEditorController`).
- The proxy getter/setter pairs that currently blur ownership on the god object.
- The dirty-notification fan-out and the `AutoSave` handle that callers currently thread through many mutation sites.
- WASM construction details — `PixelCanvas`, `ViewportData`, `HistoryManager` instantiation live behind `CanvasBackend`.
- The nine-parameter constructor — replaced by small options bags per layer.

## Commits

Seven commits. Commits 1–5 are additive scaffolding; Commit 6 is the atomic switch; Commit 7 is the atomic deletion. Every commit must leave `main` green under the three-check gate (`bun run check`, `bun run test`, `cargo test`). Commits 1–5 and 7 introduce no observable behavior change; Commit 6 is the only commit that changes runtime object identity, and it must preserve behavior (verified by manual Playwright E2E and Storybook smoke).

### Commit 1 — `feat: introduce CanvasBackend umbrella port + fake`

Create the umbrella port that aggregates the existing individual adapters (`CanvasFactory`, `CanvasConstraints`, `ViewportOps`, `HistoryManager` factory, `DrawingOps` factory) into a single injection point.

New files:

- `src/lib/canvas/editor-session/canvas-backend.ts` — the `CanvasBackend` interface.
- `src/lib/canvas/editor-session/fake-canvas-backend.ts` — a pure-TypeScript fake composed from existing `createFakePixelCanvas` / `createFakeDrawingOps` primitives plus new in-memory `ViewportOps` and `HistoryManager` shims. Returns a full `CanvasBackend`.

Modifications:

- `src/lib/canvas/wasm-backend.ts` — add a `wasmBackend: CanvasBackend` export that composes the existing `canvasFactory`, `canvasConstraints`, `viewportOps`, `createHistoryManager`, `createDrawingOps` values. Existing individual exports are unchanged; callers not yet migrated continue to import them.

No consumers change. Additive only.

### Commit 2 — `feat: introduce TabState (per-tab editor session) + tests`

Create the per-tab state layer with its own `ToolRunner` internally, auto-dirty emission, and drawing effect dispatch.

New files:

- `src/lib/canvas/editor-session/tab-state.svelte.ts` — `TabState` class. `TabStateDeps` bag: `backend`, `shared`, `keyboard` (`{ getShiftHeld(): boolean }`), `notifier`, `documentId`, `canvasConfig`. Owns `$state`-backed canvas/viewport/renderVersion/resizeAnchor/isExportUIOpen, owns `samplingSession`, owns `toolRunner` wired to a host that projects `pixelCanvas` (own) and `foregroundColor`/`backgroundColor` (from `shared`). Methods: `drawStart`/`draw`/`drawEnd` (dispatch `ToolRunner` effects internally — `canvasChanged` bumps `renderVersion` and calls `notifier.markDirty`, `canvasReplaced` swaps the canvas, `addRecentColor` calls `shared.addRecentColor`, `colorPick` sets `shared.foregroundColor`), `undo`, `redo`, `clear`, `pushHistorySnapshot`, `resize`, `toSnapshot`.
- `src/lib/canvas/editor-session/tab-state.svelte.test.ts` — unit tests using `createFakeCanvasBackend()` + `createFakeDirtyNotifier()` + a plain `SharedState` + a `{ getShiftHeld: () => false }` stub. Assertions: ownership (canvas/viewport are owned, shared is referenced), renderVersion increments on `canvasChanged`, auto-emit on mutation, undo across resize uses `canvasReplaced` path, effect dispatcher handles all `EditorEffect` variants, snapshot round-trips preserve state.

No consumers change.

### Commit 3 — `feat: introduce DirtyNotifier port + auto-save adapter + fake`

Create the persistence-side port mirroring the existing `AutoSave` API.

New files:

- `src/lib/canvas/editor-session/dirty-notifier.ts` — `DirtyNotifier` interface with `markDirty(documentId: string): void` and `notifyTabRemoved(documentId: string): void`. Production adapter exported as `autoSaveDirtyNotifier` (or a factory `createAutoSaveDirtyNotifier(autoSave)` if `AutoSave` is instance-scoped — check current shape in `src/lib/session/auto-save.ts` during implementation).
- `src/lib/canvas/editor-session/fake-dirty-notifier.ts` — array-capture fake exposing `dirtyCalls: string[]` and `tabRemovedCalls: string[]` for assertions.

No consumers change.

### Commit 4 — `feat: introduce Workspace (editor-session/) + tests`

Create the new `Workspace` layer alongside the old `src/lib/canvas/workspace.svelte.ts` (which remains untouched). File name collision is acceptable because the new file lives in the `editor-session/` subfolder.

New files:

- `src/lib/canvas/editor-session/workspace.svelte.ts` — new `Workspace` class. Constructor options: `backend`, `notifier`, `keyboard` (`{ getShiftHeld(): boolean }`), `initialDocument`/`restored`. Owns: `shared` (instantiated internally), `tabs: TabState[]`, `activeIndex`. Methods: `createTab(config)` (the canonical producer — bakes ambient deps), `addTab`, `closeTab`, `setActiveTab`, `openDocument`, `toSnapshot`. Auto-emits `markDirty` on shared-state setters (via wrapped setters or reactive effect) and `notifyTabRemoved` + `markDirty` on `closeTab`. Getter `activeTab` returns the current `TabState`.
- `src/lib/canvas/editor-session/workspace.svelte.test.ts` — parity with existing `src/lib/canvas/workspace.svelte.test.ts` behaviors (tab numbering, add/close/active switching, shared-state sharing, `openDocument`, `toSnapshot`, `pixelPerfect` hydration) **plus** new assertions: `closeTab` invokes `notifier.notifyTabRemoved` with correct documentId, `shared.setActiveTool` triggers `notifier.markDirty(activeDocumentId)`, `addTab` triggers `markDirty` on the new tab.

No consumers change.

### Commit 5 — `feat: introduce EditorController + createEditorController factory + tests`

Create the UI facade and its composition root factory.

New files:

- `src/lib/canvas/editor-session/editor-controller.svelte.ts` — `EditorController` class. Constructor: `constructor(readonly workspace: Workspace, readonly keyboard: KeyboardInput)`. Exposes all convenience getters listed under "Layer 3" above as plain getter proxies. Setter methods: `setTool`, `setForegroundColor`, `setBackgroundColor`, `togglePixelPerfect`. Handler delegators forward to `workspace.activeTab.X` or `keyboard.X`. `workspace` and `keyboard` are `readonly` fields — exposing them IS the escape hatch.
- `src/lib/canvas/editor-session/create-editor-controller.ts` — the composition root factory. Takes `{ backend, notifier, initialDocument | restored }`. Internally: creates `SharedState`, forward-declares `workspace`, creates `keyboard` with a host whose callbacks close over `workspace`, creates `workspace` with `{ getShiftHeld: () => keyboard.isShiftHeld }`, returns `new EditorController(workspace, keyboard)`.
- `src/lib/canvas/editor-session/editor-controller.svelte.test.ts` — unit tests. Assertions: every getter projects the correct underlying value (test all 18+ getters with a minimal fake workspace or `createEditorController` + fake ports), setter methods route correctly (e.g., `setTool('line')` updates `workspace.shared.activeTool` and triggers `notifier.markDirty`), handler delegation (`handleUndo` calls `workspace.activeTab.undo`), keyboard projections reflect `keyboard.isSpaceHeld`, escape hatches (`editor.workspace`, `editor.keyboard`) return the constructor-injected instances.

No consumers change.

### Commit 6 — `refactor: switch editor composition to EditorController` (atomic)

The single commit where the application switches from `EditorState`/old `Workspace` to `EditorController`/new `Workspace`. Touches every file that directly imports `EditorState` or the old `Workspace`. Must be one commit because the type surface changes in all of them simultaneously.

Modifications:

- `src/routes/editor/+page.svelte` — replace construction (`new EditorState(...)` / `createWorkspace(...)`) with `createEditorController({ backend: wasmBackend, notifier: autoSaveDirtyNotifier, ... })`. Remove the 7 manual `autoSave.markDirty(...)` and `autoSave.notifyTabRemoved(...)` call sites that wrap tab lifecycle and shared-state mutations. Remove the `$effect` that tracks `editor.renderVersion` and calls `markDirty`.
- `src/lib/canvas/tool-runner.svelte.ts` — no change expected (uses `ToolRunnerHost` interface; producer of the host changes inside `TabState`).
- `src/lib/canvas/keyboard-input.svelte.ts` — no change expected (uses `KeyboardInputHost` interface; producer of the host changes inside `createEditorController`).
- Any other file that imports `EditorState` or the old `Workspace` — rewrite its import and type usage to `EditorController` / new `Workspace`.

`EditorState` class and old `Workspace` class still exist (files untouched) so that their existing test files continue to run green. Nothing imports them after this commit except their own tests.

**Verification before merging this commit:** run `bun run check` + `bun run test` + `cargo test` (green gate) and additionally run the Playwright E2E suite and Storybook build locally. Both should pass with no changes (behavior is unchanged). Smoke-test the editor in a dev browser: open the app, draw a stroke, undo, add a tab, close a tab, verify IndexedDB auto-save fires (inspect DevTools Application tab).

### Commit 7 — `chore: retire EditorState + legacy Workspace` (atomic deletion)

The single irreversible commit. Removes all remnants of the old implementation.

Deletions:

- `src/lib/canvas/editor-state.svelte.ts` (~368 LOC).
- `src/lib/canvas/editor-state.svelte.test.ts` (~1210 LOC).
- `src/lib/canvas/workspace.svelte.ts` (old — ~134 LOC).
- `src/lib/canvas/workspace.svelte.test.ts` (old — ~367 LOC).

Verification: `bun run check` passes (no dangling imports), `bun run test` passes (the new test suites cover what the deleted ones covered), `cargo test` unaffected. A Playwright smoke run confirms no regression.

This is the only irreversible commit in the sequence. Revert plan: `git revert` produces a rollback commit that restores the old files; however, because Commit 6 already switched consumers to the new types, a true rollback would also need to revert Commit 6. In practice, if a regression surfaces after Commit 7, the cheapest path forward is to fix forward on the new types.

## Decision Document

### Dependency strategy

Mixed: **in-process** for the pure state layers, **ports & adapters** for the two cross-boundary concerns.

- `TabState` and `Workspace` are merged directly into the deepened module — they own their data, their reactivity is a Svelte 5 runtime implementation detail, and they have no I/O. They accept ambient references (`SharedState`, keyboard callback bag, `DirtyNotifier`) via constructor injection but do not treat them as ports requiring interface stability.
- `CanvasBackend` is the port for WASM-backed construction of canvases, viewports, history managers, and drawing operations. The production adapter is `wasmBackend`, composed from the existing individual exports (`canvasFactory`, `canvasConstraints`, `viewportOps`, `createHistoryManager`, `createDrawingOps`). The test adapter is a pure-TypeScript `createFakeCanvasBackend()` composed from existing fake primitives. Tests never touch WASM.
- `DirtyNotifier` is the port for persistence dirty notifications. Two methods only: `markDirty(documentId)` and `notifyTabRemoved(documentId)` — mirror the existing `AutoSave` API exactly so the production adapter is trivial. Test adapter is an array-capture fake. Tests never touch IndexedDB.
- `SamplingSession`, `ToolRunner`, and `KeyboardInput` remain in-process factories — `SamplingSession` and `ToolRunner` are constructed inside `TabState`; `KeyboardInput` is constructed inside `createEditorController` and owned by `EditorController`.

### Architectural decisions

1. **Parallel introduction**. Commits 1–5 build the new layers alongside the existing `EditorState` and old `Workspace` without modifying them. Consumers switch at a single designated commit (Commit 6). Rationale: each additive commit is trivially reversible; no commit is forced to straddle both shapes.
2. **Separate commits per port**. `CanvasBackend` (Commit 1) and `DirtyNotifier` (Commit 3) each get their own commit, before the layer that consumes them. Rationale: each port is a small, stable contract worth its own commit for review clarity and bisect resolution.
3. **Subfolder placement**. New types live in `src/lib/canvas/editor-session/`. Old `editor-state.svelte.ts` and `workspace.svelte.ts` remain in `src/lib/canvas/` root until Commit 7 deletes them. Rationale: the subfolder signals "new cohesive cluster" without forcing early file renames on the old code, and avoids naming collisions between the new `workspace.svelte.ts` and the old one.
4. **Single atomic switch commit**. The migration from `EditorState` to `EditorController` happens in one commit that touches every direct consumer (~4–7 files: `+page.svelte` and any file that imports `EditorState` or the old `Workspace`). Rationale: the type surface changes at all call sites simultaneously, and splitting would require interim compatibility shims that add more churn than they save.
5. **Auto-dirty emission**. `TabState` and `Workspace` internally emit `DirtyNotifier.markDirty` on every persistable mutation. The 7 manual `markDirty` / `notifyTabClosed` call sites in `+page.svelte` and the `$effect` that tracks `renderVersion` are removed in Commit 6. Rationale: implicit-but-reliable fan-out beats scattered explicit calls that are easy to forget; the contract is locked in by `Workspace` unit tests (Commit 4) and `TabState` unit tests (Commit 2).
6. **Green-gate definition**. Each commit must pass `bun run check` + `bun run test` + `cargo test`. Playwright E2E and Storybook build are **not** per-commit gates — they run once at the Commit 6 switch (before and after) as manual smoke. Rationale: this refactor is internal structural change with no routing/DOM change; per-commit E2E would burn cycles without adding signal.
7. **CanvasBackend as umbrella port**. A new aggregate interface rather than injecting individual ports (`CanvasFactory`, `HistoryManager`, `ViewportOps`, `DrawingOps`) separately. Rationale: these ports are always used together and conceptually represent "the drawing engine"; an umbrella gives tests a single injection point and signals the coupling at the type level.
8. **DirtyNotifier mirrors existing API**. Two methods (`markDirty`, `notifyTabRemoved`), identical signature to `AutoSave`. Rationale: trivial adapter, no translation layer, no speculative expansion (additional event types can be added when a consumer actually needs them).
9. **TabState construction via `Workspace.createTab` + public constructor**. `Workspace.createTab(config)` is the canonical producer and bakes in ambient deps. The `TabState` constructor is also exported and accepts a full `TabStateDeps` bag so unit tests can instantiate a tab directly with fake ports. Rationale: supports both integration tests (through `Workspace`) and isolation tests (direct `TabState`).
10. **Composition root as factory function**. `createEditorController({ backend, notifier, initialDocument | restored })` assembles the entire object graph. Circular init between `KeyboardInput` and `workspace.activeTab.toolRunner` is resolved by forward-declared `let workspace` + closures in keyboard host callbacks. Keyboard is owned by `EditorController`, not `Workspace`. Rationale: centralizes wiring, keeps `Workspace` free of UI-transient concerns, avoids partial-state foot-guns.
11. **Plain getter proxies for convenience getters**. `get activeTool() { return this.workspace.shared.activeTool; }` — no `$derived`. Rationale: Svelte 5 auto-reactivity propagates through getter reads; `$derived` caching has no payoff for O(1) projections; matches existing project pattern (`keyboard-input.svelte.ts`, `tool-runner.svelte.ts`).
12. **Minimal setter surface**. Only four setter methods on `EditorController`: `setTool`, `setForegroundColor`, `setBackgroundColor`, `togglePixelPerfect`. All other mutations go through escape hatches (`editor.workspace.shared.X = ...`, `editor.workspace.activeTab.X`). Rationale: avoids re-growing the god object; setter promotion to the facade happens only when a mutation becomes UI-button-driven and benefits from validation/normalization.

### Commit sequence summary

| # | Type | Scope | Consumers touched |
|---|---|---|---|
| 1 | additive | `CanvasBackend` port + fake | 0 |
| 2 | additive | `TabState` + tests | 0 |
| 3 | additive | `DirtyNotifier` port + fake | 0 |
| 4 | additive | `Workspace` (new) + tests | 0 |
| 5 | additive | `EditorController` + factory + tests | 0 |
| 6 | migration | atomic consumer switch | ~4–7 files |
| 7 | deletion | retire old `EditorState` + old `Workspace` + their tests | 0 (imports already gone by Commit 6) |

## Testing Decisions

A good test is a behavioral specification: a reader unfamiliar with the implementation should understand what the module does from its tests. Tests assert outcomes, not internal steps. Refactoring internals without changing behavior should not break a test — if it does, the test was coupled to implementation.

### What gets tested where

- **`CanvasBackend` port (Commit 1)** — no new tests. The port is a pure interface; the production adapter is a literal composition of already-tested values; the fake is exercised transitively through `TabState` and `Workspace` tests.
- **`TabState` (Commit 2)** — new file `editor-session/tab-state.svelte.test.ts`. Behaviors tested: per-tab ownership (canvas/viewport/history/samplingSession are owned; `shared` is referenced only), `renderVersion` increments on `canvasChanged` effect, `canvasReplaced` swaps the underlying canvas and increments `renderVersion`, `addRecentColor` effect propagates to `shared`, `colorPick` effect propagates to `shared.foregroundColor`, auto-emit of `markDirty(documentId)` on mutation, undo-across-resize round-trips canvas dimensions, `toSnapshot` captures the full per-tab state.
- **`DirtyNotifier` port (Commit 3)** — no new tests. The interface is two-method; the production adapter is a literal object; the fake is exercised transitively through `TabState` and `Workspace` tests.
- **`Workspace` new (Commit 4)** — new file `editor-session/workspace.svelte.test.ts`. Parity with existing `src/lib/canvas/workspace.svelte.test.ts` (28 behaviors) plus new assertions for dirty-notification contract: `closeTab` calls `notifier.notifyTabRemoved(documentId)` exactly once with the removed tab's id; every `shared` setter triggers `markDirty(activeDocumentId)`; `addTab` triggers `markDirty` for the new tab; `openDocument` triggers `markDirty` for the loaded document.
- **`EditorController` (Commit 5)** — new file `editor-session/editor-controller.svelte.test.ts`. Facade-scoped tests: every convenience getter projects the correct underlying value, every setter routes to `workspace.shared` (and triggers auto-dirty), every handler delegates to the correct owner (`handleUndo` → `workspace.activeTab.undo`, `handleKeyDown` → `keyboard.handleKeyDown`), `editor.workspace` and `editor.keyboard` return the injected instances (escape hatches intact), `createEditorController` returns a fully wired controller and the circular closure resolves correctly under a draw + keyboard interaction.

### What is NOT tested in the new suites (intentionally)

Tool behavior end-to-end (line/rectangle/ellipse/eyedropper/flood-fill/move/eraser, shift constrain, right-click background color, `addRecentColor` per tool) — **already covered** by `tool-runner.svelte.test.ts`, `stroke-engine.test.ts`, `shape-tool.test.ts`, `pixel-perfect-ops.test.ts`. These suites are not touched by this refactor. Keyboard input behaviors (Alt eyedropper override with restore, Shift-constrain modifier, shortcut hints visibility) — **already covered** by `keyboard-input.svelte.test.ts`. Shared state mutations (`swapColors`, `setActiveTool`, `addRecentColor`) — **already covered** by `shared-state.svelte.test.ts`.

The current `editor-state.svelte.test.ts` overlaps heavily with those lower-layer suites. It additionally asserts integration behaviors (e.g., "right-click draws with background color" exercising shared-state + tool-runner + effect-dispatcher together). Those integration behaviors are captured in Commit 2's `TabState` tests (the effect dispatcher lives there) and Commit 5's `EditorController` smoke tests (setter → mutation path).

### What is deleted and when

- `editor-state.svelte.test.ts` (1210 LOC) — deleted in Commit 7 together with its subject. No mechanical port to `editor-controller.svelte.test.ts`. Coverage is preserved via Commits 2/4/5 and the untouched lower-layer suites.
- `src/lib/canvas/workspace.svelte.test.ts` (367 LOC) — deleted in Commit 7. Its 28 behaviors are covered by Commit 4's new `workspace.svelte.test.ts` (parity verified when that file is written).

### Prior art

`tool-runner.svelte.test.ts` already uses `createFakeDrawingOps` / `createFakePixelCanvas` + plain `SharedState` + stub callbacks to unit-test effect dispatch without WASM. This refactor extends that pattern one layer up (`TabState` composes a `ToolRunner` and tests the combined effect dispatcher the same way).

`076-deepen-tool-dispatch.md` established the "sugar first, engine last" shape with green commits all the way through and a single irreversible deletion commit. This plan follows the same pattern at a smaller commit count (7 vs 11) because the two ports already exist in the codebase as individual adapters — there is less net-new surface to build.

### Test environment needs

- A pure-TypeScript `createFakeCanvasBackend()` colocated in `editor-session/`, composing `createFakePixelCanvas` / `createFakeDrawingOps` (existing) with new in-memory `ViewportOps` and `HistoryManager` shims. No new test framework, no WASM in any test.
- A `createFakeDirtyNotifier()` array-capture fake colocated in `editor-session/`. No IndexedDB.
- No new test environment beyond `happy-dom + Vitest`.

## Out of Scope

- **Apple shell migration.** The deepened state layers are placed to support future Apple-shell reuse via a Metal-backed `CanvasBackend`, but this refactor does not implement that. Apple shell continues to use its own SwiftUI state layer.
- **New editor features.** Per-document settings, per-tab tool overrides, layer stacks, snapshot branching, cloud sync — enabled by this architecture but implemented later.
- **Changes to `ToolRunner`, `StrokeEngine`, `SamplingSession`, `KeyboardInput` internals.** These already use Host / port-like patterns and are left untouched. Only their producers change.
- **Deprecation of individual port exports** (`canvasFactory`, `viewportOps`, `createHistoryManager`, `createDrawingOps` from `wasm-backend.ts`). They remain exported for any non-session consumer that imports them directly. If future work shows no such consumers exist, a separate commit can prune them.
- **Mechanical port of `editor-state.svelte.test.ts` to `editor-controller.svelte.test.ts`.** 1210 LOC of integration tests are not translated one-for-one. Coverage is redistributed across Commits 2/4/5 plus untouched lower-layer suites. If a specific behavior turns out to be uncovered after deletion, it can be added to the appropriate new suite.
- **IndexedDB quota handling, document rename, canvas resize via border drag.** Unrelated open items tracked separately in `tasks/todo.md`.
- **Re-opening the `AutoSave` API contract.** `DirtyNotifier` mirrors the existing two methods exactly; extending `AutoSave` with new events is a separate concern.

## Further Notes

- **`DirtyNotifier` as a persistence integration seam.** Future persistence backends (cloud sync, project-file-format saves, undo-group batching) can adapt the port without changing the state layers.
- **`CanvasBackend` as an Apple-shell seam.** If the Apple shell ever wants to reuse the TypeScript session layers (with a Metal-backed canvas implementation bridged through UniFFI), `CanvasBackend` is the swap point. This is an option the refactor keeps open, not a commitment to implement.
- **Convenience-getter contract as project convention.** Short-form `editor.X` is the preferred common-case read path; long-form `editor.workspace.shared.X` / `editor.workspace.activeTab.X` / `editor.keyboard.X` is the explicit escape hatch for persistence, test, and debug code where ownership must be visible. This convention should be documented near the `EditorController` type definition (class-level doc comment) so future contributors pick the right path by default.
