---
title: Deepen tool dispatch — author sugar constructors + opaque stroke engine
status: open
created: 2026-04-19
---

## Problem

Issue 075 landed typed openers: `StrokeSessions` with one opener per `DrawTool.kind`. Per-stroke state and pixel-perfect mid-stroke policy are now localized. The next layer of shallowness sits one step up — at the seams where **tool authors** write tools and where the **runner** dispatches them.

### Friction 1 — `DrawTool.kind` leaks author taxonomy through the runner

`tool-runner.svelte.ts:151` contains a 5-way `switch (tool.kind)` that passes slightly-different spec shapes to `sessions.<kind>(spec)`. Every new kind needs edits in the `DrawTool` union, the `StrokeSessions` interface, the opener implementation, and the runner's switch — four edit sites for one concept.

### Friction 2 — metadata and orchestration split across two files

Flags on the tool (`addsActiveColor`, `supportsPixelPerfect`, `capturesHistory`) describe session behavior, but the behavior itself lives in the opener. To understand "what happens on pencil click," a reader traces four locations: `tool-registry.ts` (registration) → `tools/pencil-tool.ts` (apply + flags) → `stroke-session.ts` (opener semantics) → `tool-runner.svelte.ts` (switch case). Same concept, four files.

### Friction 3 — the common case carries uncommon-case boilerplate

Six of eight tools are "paint pixels per sample" variants (pencil, eraser, line, rectangle, ellipse, and conceptually floodfill). A pencil definition requires a kind literal, three boolean flags, an `apply` function, registry metadata, factory wiring, and a dispatch case. Boilerplate overwhelms the one line that describes the actual drawing.

**Dependency category**: **In-process** — synchronous, in-memory, no I/O.

## Proposed Interface

Split the tool-dispatch surface into two ends, with the session-orchestration middle layer fully internal.

### Author surface — sugar constructors + escape hatch

```ts
export type ApplyFn = (
  ctx: ToolContext,
  current: CanvasCoords,
  previous: CanvasCoords | null
) => boolean;

/** Common case. Defaults: supports PP, adds active color. Always pushes history at start. */
export function continuousTool(spec: {
  id: ToolType;
  apply: ApplyFn;
  addsActiveColor?: boolean;        // default true
  pixelPerfect?: boolean;           // default true
}): DrawTool;

/** Shape preview — snapshot-restore + shift-constrain provided automatically. */
export function shapeTool(spec: {
  id: ToolType;
  stroke: (ctx: ToolContext, start: CanvasCoords, end: CanvasCoords) => void;
  constrainOnShift: (start: CanvasCoords, end: CanvasCoords) => CanvasCoords;
  addsActiveColor?: boolean;        // default true
}): DrawTool;

/** Click-once. Defaults: captures history, adds active color. */
export function oneShotTool(spec: {
  id: ToolType;
  execute: (ctx: ToolContext, target: CanvasCoords) => ToolEffects;
  addsActiveColor?: boolean;        // default true
  capturesHistory?: boolean;        // default true
}): DrawTool;

/** Escape hatch — full session control for oddballs (eyedropper, move). */
export function customTool(spec: {
  id: ToolType;
  open(host: SessionHost, spec: StrokeSpec): StrokeSession;
}): DrawTool;

/** Opaque to consumers — only the engine calls `.open()`. */
export interface DrawTool {
  readonly id: ToolType;
  open(host: SessionHost, spec: StrokeSpec): StrokeSession;
}
```

The `kind` discriminator is gone. `DrawTool` is a nominal opaque type carrying `id` and `open()`; the sugar constructors produce it.

Pencil shrinks to the algorithm only:

```ts
export const pencilTool = continuousTool({
  id: 'pencil',
  apply: (ctx, cur, prev) => {
    const seg = prev
      ? ctx.ops.interpolatePixels(prev.x, prev.y, cur.x, cur.y)
      : new Int32Array([cur.x, cur.y]);
    return ctx.ops.applyStroke(seg, 'pencil', ctx.drawColor);
  },
});
```

Line shrinks to `stroke` + `constrainOnShift`:

```ts
export const lineTool = shapeTool({
  id: 'line',
  stroke: (ctx, s, e) => {
    const pts = ctx.ops.interpolatePixels(s.x, s.y, e.x, e.y);
    ctx.ops.applyStroke(pts, 'line', ctx.drawColor);
  },
  constrainOnShift: constrainLine,
});
```

Eyedropper stays in `customTool` — its deferred-commit semantics don't fit any sugar.

### Consumer surface — opaque stroke engine

```ts
export interface StrokeEngineDeps {
  readonly host: ToolRunnerHost;
  readonly shared: SharedState;            // reads .activeTool, .pixelPerfect
  readonly history: { pushSnapshot(): void };
  readonly sampling: SamplingSession;
  readonly isShiftHeld: () => boolean;
}

export interface ActiveStroke {
  sample(current: CanvasCoords, previous: CanvasCoords | null): EditorEffects;
  refresh(): EditorEffects;                // modifier change
  end(): EditorEffects;
}

export interface StrokeEngine {
  begin(opts: { button: number; pointerType: PointerType }): {
    stroke: ActiveStroke;
    effects: EditorEffects;                // start() effects folded in
  };
}

export function createStrokeEngine(deps: StrokeEngineDeps): StrokeEngine;
```

`ToolRunner`'s stroke-dispatch body collapses to roughly 40 lines:

```ts
const engine = createStrokeEngine({ host, shared, history, sampling, isShiftHeld });
let active: ActiveStroke | null = null;

return {
  drawStart(button, pointerType) {
    const { stroke, effects } = engine.begin({ button, pointerType });
    active = stroke;
    isDrawing = true;
    return effects;
  },
  draw(cur, prev)   { return active?.sample(cur, prev) ?? NO_EFFECTS; },
  modifierChanged() { return active?.refresh() ?? NO_EFFECTS; },
  drawEnd() {
    const fx = active?.end() ?? NO_EFFECTS;
    active = null;
    isDrawing = false;
    return fx;
  },
  // undo / redo / clear / pushSnapshot unchanged
};
```

No `switch (tool.kind)`. No opener names at the call site. No knowledge of which tools support pixel-perfect.

### Escape-hatch surface — `customTool` author types

```ts
export interface SessionHost {
  readonly pixelCanvas: PixelCanvas;
  readonly foregroundColor: Color;
  readonly backgroundColor: Color;
  readonly baseOps: DrawingOps;            // unwrapped — sugar decides PP-wrap
  readonly history: { pushSnapshot(): void };
  readonly sampling: SamplingSession;
  readonly isShiftHeld: () => boolean;
}

export interface StrokeSpec {
  readonly drawColor: Color;
  readonly drawButton: number;
  readonly inputSource: LoupeInputSource;
}

export interface StrokeSession {           // 4-method internal contract
  start(): EditorEffects;
  draw(current: CanvasCoords, previous: CanvasCoords | null): EditorEffects;
  modifierChanged(): EditorEffects;
  end(): EditorEffects;
}
```

`customTool` authors receive `SessionHost` (editor-scoped dependencies) and `StrokeSpec` (per-stroke identity), and return a 4-method `StrokeSession`. This matches today's `openLiveSampleSession(spec, deps)` signature — eyedropper lifts with minimal translation.

### What this hides

Behind the engine + sugar constructors:

- The five session-opener implementations.
- Pixel-perfect decorator composition — read once at stroke open, scoped per-stroke, opt-in via constructor default.
- Snapshot capture + restore-for-preview — lives inside `shapeTool` once; shape authors never touch `restore_pixels`.
- History-snapshot timing — defaulted to "before first mutation at stroke start," opt-out via `capturesHistory: false` on `oneShotTool`.
- `ToolContext` construction per sample.
- Fire-once / started-once guards for oneShot and liveSample.
- Input-source mapping (`pen → mouse`) for loupe positioning.
- Tool resolution from `shared.activeTool`.
- `addRecentColor` emission.

## Commits

Eleven commits staged as Strategy C — sugar first, engine last. Each commit leaves `main` green with no observable behavior change. Commits 2–6 migrate one tool category per commit (customTool split across 2 to isolate eyedropper and move). Commits 7–10 rotate tests and consolidate files. Commit 11 makes `DrawTool` opaque — the only irreversible step, taken last.

### Commit 1 — Sugar constructor scaffolding

Introduce a new `tool-authoring` module exporting four sugar constructors (`continuousTool`, `shapeTool`, `oneShotTool`, `customTool`), the `ApplyFn` type, and the public types `SessionHost`, `StrokeSpec`, and `StrokeSession`. Each sugar returns the existing `DrawTool` union shape (same `kind`, same fields) plus a new `open(host, spec)` method. The `open()` implementation delegates to the corresponding opener helper already in the stroke-session module. No existing tool file is touched; no runner code is touched; nothing in the production path calls into the new module yet.

*Leaves the program working because:* purely additive, unused code.

### Commit 2 — pencil + eraser via `continuousTool`

Rewrite the pencil tool file so both `pencilTool` and `eraserTool` are produced by `continuousTool(...)` calls. Output shape is unchanged. Registry references the new singletons without changing its own shape (still uses the `DrawTool | (ops) => DrawTool` dual form).

*Leaves the program working because:* produced objects still satisfy the existing `ContinuousTool` interface. Runner's switch dispatches identically. Old continuous tests exercise the same code path.

### Commit 3 — line + rectangle + ellipse via `shapeTool`

Rewrite the shape tool file. Each of `lineTool`, `rectangleTool`, `ellipseTool` becomes a `shapeTool(...)` call. The `ops` closure pattern goes away — the tool's `stroke` function uses `ctx.ops`. `constrainFn` moves into the sugar's spec as `constrainOnShift`. `onAnchor` is dropped; the sugar's default fires `stroke(ctx, start, start)` on first sample (verified equivalent to today's single-pixel anchor stamp via WASM's degenerate-input handling for `interpolate_pixels`, `rectangle_outline`, `ellipse_outline`). Registry drops the `(ops) => createShapeTool(...)` factory form for these three and uses static singletons; the `createShapeTool` helper is deleted.

*Leaves the program working because:* output still satisfies `ShapePreviewTool`; the anchor default has equivalent canvas effect; shape tests use `vi.fn()` mocks that observe callback shape, not geometry.

### Commit 4 — floodfill via `oneShotTool`

Rewrite the floodfill tool file. Registry's `tool: createFloodfillTool` factory swaps to a static `tool: floodfillTool` singleton.

*Leaves the program working because:* output still satisfies `OneShotTool`.

### Commit 5 — eyedropper via `customTool`

Rewrite the eyedropper tool file. `eyedropperTool` becomes a `customTool(...)` call; the opener body is lifted from the current `openLiveSampleSession`. The `LiveSampleTool` interface still exists in `draw-tool.ts` until commit 11 — the sugar's output includes `kind: 'liveSample'` plus `open()` to satisfy both shapes simultaneously.

*Leaves the program working because:* output still satisfies `LiveSampleTool`. Runner's switch still dispatches to `sessions.liveSample(spec)` which calls the same opener body (now invocable through two paths — the sugar's `open()` for the post-commit-7 engine, and the old path for the current runner).

### Commit 6 — move via `customTool`

Same pattern as commit 5 but for the move tool file. Output retains `kind: 'dragTransform'` plus `open()`.

*Leaves the program working because:* same reasoning as commit 5.

### Commit 7 — Engine introduced, runner delegates

Create a new `stroke-engine` module alongside the existing `stroke-session` module. Export `createStrokeEngine`, `StrokeEngine`, `ActiveStroke`, `StrokeEngineDeps`. The engine:

- Captures dependencies at factory construction.
- On `begin(opts)`: reads `shared.activeTool` and `shared.pixelPerfect` once; derives `drawColor` from button, `inputSource` from pointerType; builds `StrokeSpec`; calls `tool.open(host, spec)`; calls `session.start()`; returns `{ stroke, effects }` where `stroke` is an `ActiveStroke` adapter around the 4-method session.

Update the tool runner: remove the 5-way switch; `drawStart` calls `engine.begin()` and stores the returned stroke; `draw` calls `stroke.sample()`; `modifierChanged` calls `stroke.refresh()`; `drawEnd` calls `stroke.end()`. `tools` and `createStrokeSessions` still exist, but the runner no longer uses sessions. `createStrokeSessions` is retained purely to keep old tests importable.

*Leaves the program working because:* the sugar's `open()` delegates to the same opener functions that the old switch dispatched to. Behavior bytewise-identical. Old tests that import `createStrokeSessions` still pass.

### Commit 8 — New tests at engine + sugar seams

Add:

- `stroke-engine.test.ts` using real WASM canvas. Scenarios: input-source mapping (pen→mouse, touch→touch), tool resolution from `shared.activeTool`, per-sugar smoke tests, mid-stroke tool change does not affect active stroke, mid-stroke `pixelPerfect` toggle does not affect active PP scope, start effects fire once at `begin`, pencil PP scenarios (L-corner revert, first-touch cache, cross-sample seams — migrated from the pixel-perfect-ops test file).
- Per-sugar unit tests using fakes: `continuous-tool.test.ts`, `shape-tool.test.ts`, `one-shot-tool.test.ts`, `custom-tool.test.ts`. Each covers the sugar's default handling, opt-out flags, and internal lifecycle decisions.
- Extension of `tool-registry.test.ts` with a registry-coverage case: every exported tool has a callable `open()`. Compensates for the lost `tool satisfies never` exhaustiveness check.

Old `stroke-session.*.test.ts` files still exist — new + old coverage briefly overlap. Acceptable.

*Leaves the program working because:* purely additive tests; production code unchanged.

### Commit 9 — Retire old opener tests

Delete `stroke-session.continuous.test.ts`, `stroke-session.shapePreview.test.ts`, `stroke-session.oneShot.test.ts`, `stroke-session.dragTransform.test.ts`, `stroke-session.liveSample.test.ts`. Before each deletion, verify that its scenarios are subsumed by commit-8 tests. From `pixel-perfect-ops.test.ts`, remove the cases migrated to engine-boundary; retain the PP wrapping mechanics cases.

*Leaves the program working because:* production code and new tests unchanged.

### Commit 10 — Consolidate module layout

Rename `stroke-session.ts` → `stroke-engine.ts` via `git mv` (preserves history). Move the five opener functions (`openContinuousSession`, `openShapePreviewSession`, `openOneShotSession`, `openDragTransformSession`, `openLiveSampleSession`) from the renamed file into the `tool-authoring` module as sugar-internal helpers — each sugar constructor now invokes its own opener in-closure. Delete `createStrokeSessions` and the `StrokeSessions` interface. Consolidate types: `StrokeSession`, `SessionHost`, `StrokeSpec` owned by `tool-authoring`; `ActiveStroke`, `StrokeEngine`, `StrokeEngineDeps` owned by `stroke-engine`. Update imports across the codebase.

*Leaves the program working because:* pure file motion + symbol relocation; no type or behavior change.

### Commit 11 — Opaque `DrawTool`

In `draw-tool.ts`, delete the `ContinuousTool`, `OneShotTool`, `ShapePreviewTool`, `DragTransformTool`, `LiveSampleTool` interfaces and the `DrawTool` union. Replace with an opaque `DrawTool` interface carrying only `id` and `open()`. Sugar constructors stop emitting `kind`, `addsActiveColor`, `supportsPixelPerfect`, `capturesHistory`, `onAnchor`, `onPreview`, `constrainFn`, `applyTransform`, etc. on their output; all sugar-specific state moves from output fields into opener closure. In the registry, `ToolDef.tool` becomes `DrawTool` (no longer `DrawTool | (ops) => DrawTool`); `createAllTools(ops)` collapses or is deleted. `ToolType` stays.

*Leaves the program working because:* type-level cleanup plus closure encapsulation of per-sugar state. Runtime behavior unchanged; all tests still pass.

**This is the only irreversible commit.** The `kind` discriminator is gone. All prior commits can be rolled back independently.

## Decision Document

### Migration strategy

**Sugar first, engine last (Strategy C).** Each intermediate commit advances toward the final shape rather than away from it. The structural change — switch deletion and opaque `DrawTool` — lands last when all tools are already produced by sugars. Alternatives considered: adapter-bridge temporarily leaks `open()` into the `ContinuousTool` interface (wrong direction); build-then-flip concentrates risk in a final big commit.

### Sugar taxonomy

Three sugars plus one escape hatch: `continuousTool` (pencil, eraser), `shapeTool` (line, rectangle, ellipse), `oneShotTool` (floodfill), `customTool` (eyedropper, move). `oneShotTool` kept despite having only one user — the "click-once" pattern is structurally distinct and future stamp/airbrush-once tools land free. `customTool` preferred over premature `samplingTool`/`transformTool` sugars; second-user triggers promotion.

### Sugar spec shape (YAGNI-minimum)

Three trimmings from the initial sketch:

- **`shapeTool.anchor` dropped.** Default is `stroke(ctx, start, start)` on first sample. WASM geometry helpers handle degenerate input correctly; all three current shape tools behave equivalently under this default.
- **`continuousTool.capturesHistory` dropped.** No current opt-out; added back when a non-committing continuous tool arrives.
- **`pixelPerfect: 'supports' | 'never'` collapsed to `boolean`.** Parity with `addsActiveColor`; `'always'` variant not needed today.

`addsActiveColor` is retained as a flag on all four sugars since eraser opts out today and future shape tools (selection rect) would want opt-out.

### `DrawTool` opaqueness

Post-commit-11, `DrawTool` is an opaque interface carrying `id: ToolType` and `open()`. All sugar-specific behavior (PP wrap, snapshot capture, `addsActiveColor` emission, fire-once guards, history timing) lives in the closure inside `open()`. Consumers (engine) treat `DrawTool` as opaque — only `id` and `open()` are observable.

The `id` field is retained (not pushed down to registry-only) to enable error messages, DevTools inspection, and the registry-coverage test that replaces the lost exhaustiveness check.

### `StrokeSession` (4-method internal) vs `ActiveStroke` (3-method external)

The sugar opener's natural expression is 4 methods: `start/draw/modifierChanged/end`. The engine's external API hides `start` (folded into `begin()` return) and renames the other two for generality: `sample` for non-drawing tools like eyedropper, `refresh` for future non-modifier triggers like zoom or camera. The engine is the adapter between the two names — adaptation cost is trivial, and sugar authors write the cleaner internal expression. `StrokeSession` stays exported for `customTool` authors (they return this shape).

### Engine dispatch contract

Engine captures dependencies at factory construction (editor lifetime). On `begin({button, pointerType})` it reads `shared.activeTool` and `shared.pixelPerfect` **once**, derives `drawColor` and `inputSource`, calls `tool.open(host, spec)`, calls `session.start()`, returns `{ stroke, effects }`. Mid-stroke changes to `shared.activeTool` or `shared.pixelPerfect` do not affect the active stroke — the stroke closure captures resolved values. Inherits Issue 075's PP tail invariant. `isShiftHeld` is read live per `sample()`/`refresh()` because shape tools need the current value.

### `SessionHost` shape

Exposes the full editor-scoped deps set: `pixelCanvas`, `foregroundColor`, `backgroundColor`, `baseOps`, `history` (write-only `pushSnapshot` port), `sampling`, `isShiftHeld`. Naming `baseOps` (not `ops`) makes the decorator seam explicit — sugar-internal openers wrap for PP before building `ToolContext.ops`. `sampling` is unconditionally exposed; customTool authors pull what they need.

### `StrokeSpec` shape

`{ drawColor, drawButton, inputSource }`. Unified across all sugars; tools ignore fields they don't use (eyedropper ignores `drawColor`, most ignore `inputSource`). Positional args rejected in favor of a structured spec for add-field stability.

### Module organization

Two new responsibilities, two new module boundaries:

- **Authoring module** owns: sugar constructors, sugar-internal openers, `ApplyFn`, `SessionHost`, `StrokeSpec`, `StrokeSession`.
- **Engine module** (renamed from stroke-session) owns: `createStrokeEngine`, `StrokeEngine`, `ActiveStroke`, `StrokeEngineDeps`.
- **`draw-tool` module** shrinks to: opaque `DrawTool`, `ToolContext`, `ToolEffect` union + effect constants.
- **Registry** simplifies: static tool singletons, no `(ops) => DrawTool` factory form.
- **Tool files** each become a single sugar call.
- **Runner** public API unchanged; internal body shrinks to engine delegation.

### Naming

- `ToolType` kept codebase-wide (not renamed to `ToolId`) — existing convention; rename out of scope.
- `SessionHost`, `StrokeSpec`, `ActiveStroke`, `StrokeEngine`, `StrokeEngineDeps` are new nominal types introduced by this refactor.
- `DrawingToolType` (subset consumed by `ops.applyTool`) stays distinct from `ToolType`.

### Exhaustiveness trade-off

Removing `tool.kind` removes the compile-time `tool satisfies never` check in the runner. Replacements:

- Sugar constructor return types guarantee every tool has a callable `open()`.
- Registry-coverage test asserts every exported tool is callable by the engine.

Weaker than the compiler check; accepted deliberately — the payoff is that ToolRunner and tool authors stop needing to enumerate kinds.

### Dependency strategy

**In-process.** All dependencies synchronous and in-memory. Engine captures deps at construction; `tool.open()` receives them per-stroke.

- **`DrawingOps`** constructed inside engine from a canvas accessor. PP decoration applied inside `continuousTool`'s opener only. Ops stays substitutable for the decorator seam.
- **History** exposed as write-only `{pushSnapshot}` port. History-opting sessions call it at `start()`; opted-out sessions (eyedropper) skip.
- **Sampling** exposed as full `SamplingSession`; used only by the customTool-based eyedropper.
- **`SharedState`** passed directly (no narrow port); engine reads `activeTool` and `pixelPerfect` at `begin()` only. Svelte reactivity captures values live at stroke start.
- **`isShiftHeld`** read live per sample; shape tools depend on current value.

Tool authors depend only on `ToolContext` (narrow read surface). `customTool` behaviors additionally receive `SessionHost` for session construction. No tool file imports `DrawingOps` implementations, history, or sampling directly.

## Testing Decisions

### What makes a good test here

Tests assert on observable outcomes — canvas state after a stroke sequence, effects emitted by public methods, mock call shapes for authored callbacks. Tests do not assert on which specific internal function was called, because those internal boundaries move during this refactor.

### New test files (commit 8)

**Engine-boundary — `stroke-engine.test.ts`.** Real WASM via `canvasFactory.create`. Scenarios: input-source mapping (pen→mouse, touch→touch), tool resolution from `shared.activeTool`, per-sugar smoke tests, mid-stroke tool change does not affect active stroke, `shared.pixelPerfect` toggle mid-stroke does not affect active PP scope, start effects fire once at begin, pencil PP scenarios (L-corner revert, first-touch cache, cross-sample seams — migrated from the pixel-perfect-ops test file).

**Per-sugar units — four files.** Fakes (`FakeDrawingOps`, `FakePixelCanvas`):

- `continuous-tool.test.ts` — `addsActiveColor` default/opt-out, `pixelPerfect` default/opt-out, PP wrap composition decision, apply forwarding, history push at start.
- `shape-tool.test.ts` — default first-sample anchor via `stroke(s, s)`, subsequent-sample snapshot restore + `stroke(s, e)`, shift-held `constrainOnShift` path, `refresh()` re-render.
- `one-shot-tool.test.ts` — `fired` guard, `capturesHistory` opt-out, `addsActiveColor` opt-out.
- `custom-tool.test.ts` — `open()` receives `(host, spec)`, returned session's methods pass through, `id` attached.

### Extended tests

`tool-registry.test.ts` — add registry-coverage case asserting every exported tool has a callable `open()`. Replaces the lost `tool satisfies never` exhaustiveness.

### Retired tests (commit 9)

Five files deleted after their scenarios are verified to live in commit-8 tests: `stroke-session.continuous.test.ts`, `stroke-session.shapePreview.test.ts`, `stroke-session.oneShot.test.ts`, `stroke-session.dragTransform.test.ts`, `stroke-session.liveSample.test.ts`. From `pixel-perfect-ops.test.ts`, specific opener-level-lifecycle cases removed; PP wrapping mechanics cases retained.

### Unchanged tests

- `tool-runner.svelte.test.ts` — runner-specific behavior (undo/redo/clear, `canvasReplaced` on dimension change, `isDrawing` state). Already uses real WASM; post-refactor continues to validate runner's delegation.
- `tools/move-tool.test.ts` — `shiftPixels` pure-function coverage.
- `sampling-session.svelte.test.ts`, `sample-grid.test.ts` — sampling internals out of scope.

### Test environment

No new infrastructure. Reuse `FakeDrawingOps`, `FakePixelCanvas`, `canvasFactory.create` (real WASM), `SharedState`, `SamplingSession`. Vitest + happy-dom. FakeDrawingOps geometry helpers stay unimplemented (return empty `Int32Array`). Sugar unit tests that care about geometry use `vi.fn()` mocks; engine-boundary tests use real WASM.

### Prior art

- `tool-runner.svelte.test.ts` is the existing template for real-WASM integration tests — `stroke-engine.test.ts` follows the same pattern (`canvasFactory.create`, `SharedState`, `SamplingSession`, assertions on `get_pixel` and `EditorEffects`).
- `stroke-session.continuous.test.ts` is the existing template for opener-lifecycle unit tests with fakes — the four new per-sugar files follow that pattern, but drive through each sugar's `open(host, spec)` seam instead of `createStrokeSessions`.

## Out of Scope

- **Rust core and FFI bindings** — `crates/core/`, `wasm/`, `apple/` untouched.
- **`DrawingOps` method set** — all 8 methods remain; decorator seam unchanged.
- **`SamplingSession` internals** — long-press, loupe positioning, commit semantics unchanged.
- **Input layer** — `canvas-interaction.svelte.ts`, `wheel-input.ts`, `keyboard-input.svelte.ts` untouched.
- **ToolRunner public API** — `undo`/`redo`/`clear`/`pushSnapshot`/`drawStart`/`draw`/`modifierChanged`/`drawEnd` signatures stay identical; only bodies shrink.
- **EditorState effect handling** — `EditorEffect` shape and `renderVersion` semantics unchanged.
- **Registry keyboard shortcuts and cursor metadata** — `tool-registry.ts` stays; only stops owning session configuration and the `(ops) => DrawTool` factory form.
- **Plugin / extension points for third-party tools** — all tools live in-tree.
- **`ToolType` → `ToolId` rename** — existing name kept codebase-wide.
- **`DrawingToolType`** — 5-element union consumed by `ops.applyTool` unchanged.
- **FakeDrawingOps geometry implementation** — helpers stay as empty-return stubs.
- **StrokeRecord / replay** — no current user story.

## Further Notes

- **Relationship to issue 075**: this builds on 075's typed openers. Issue 075 delivered "one module owns per-stroke lifecycle." This issue delivers "one seam owns tool authoring, one seam owns tool dispatch." `StrokeSessions` from 075 becomes an implementation detail inside the new engine; its public surface disappears.
- **Why two seams, not one**: authors write tools; runners dispatch them. Different audiences, different ergonomic needs. One seam optimized for both serves neither.
- **Why keep `DrawTool` opaque rather than delete it**: an opaque type gives the type system a nominal name for "a thing the engine can open." Deleting it would force structural typing and lose the contract. Opacity costs nothing at runtime.
- **Why boolean `pixelPerfect` over union literal**: simpler, parity with `addsActiveColor`, no forced bikeshed at call sites. A future `'always'` variant can be introduced if a tool needs the option; no proactive reshaping.
- **Why fold `start()` effects into `begin()`**: the caller should have a single "stroke opened" call rather than open-then-start. No current code separates the phases; folding them removes a meaningless seam.
- **Why `sample`/`refresh`/`end` externally vs `draw`/`modifierChanged`/`end` internally**: internal `StrokeSession` keeps the original names (sugar openers implement them, customTool authors return them); external `ActiveStroke` renames for accuracy. `sample` covers tools that don't draw (eyedropper). `refresh` leaves room for non-modifier triggers (zoom, camera) in the future. Engine bridges the two names in one place — adaptation cost is trivial.
- **Why batch tool migrations by category (pencil+eraser, line+rect+ellipse, etc.)**: same sugar, same migration recipe within a category. Batching catches within-category shape mismatches in one commit.
- **Why eyedropper and move get individual commits despite both being `customTool`**: opener bodies are fully independent (sampling session vs raw snapshot + shifted pixels). Splitting isolates the risk of each lift.
- **Why commit 11 (opaque `DrawTool`) is last**: it's the only irreversible step. All prior commits are independently rollback-able; commit 11 lands only after engine + tests are proven across 10 green commits.
- **Risk — exhaustiveness loss**: mitigated by sugar constructor return types + registry coverage test (commit 8).
- **Risk — sugar defaults obscure opt-out**: a variant tool that should not push history sets `capturesHistory: false` on `oneShotTool`; easy to miss. Mitigated by choosing defaults that are always-safe (snapshot with no mutation is a no-op; PP is a no-op unless the user toggles the feature on).
- **Risk — `customTool` discoverability cliff**: authors browsing the three sugar constructors may not realize a fourth path exists. Mitigated by exporting `customTool` from the same module with a deliberate name and cross-referencing it from each sugar constructor's JSDoc.
