---
title: Deepen ToolRunner — encapsulate category-specific stroke logic via StrokeLifecycle
status: done
created: 2026-04-08
---

## Problem

ToolRunner is the most coupled module in the canvas layer (20 imports, 285 LOC) with an interface-to-implementation ratio of 1.4:1 — a shallow module. The core friction:

1. **Category logic scattered across switch statements.** `draw()` has a 4-way switch on `tool.kind` (continuous, oneShot, shapePreview, dragTransform), and `drawStart()` has category-specific policy branches for history push timing, snapshot capture, and recent color emission. Each category's policies are spread across multiple methods in ToolRunner rather than grouped by category.

2. **Snapshot-restore duplication.** The shapePreview restore-constrain-redraw cycle is duplicated between `draw()` and `modifierChanged()`. A bug fix in one must be mirrored in the other.

3. **Two-pass initialization.** ToolRunner requires a post-construction `connectModifiers()` call to wire the shift-key provider, creating a window where the object exists in an incomplete state.

Dependency category: **In-process** — pure computation and in-memory state, no I/O.

## Proposed Interface

### Public API (minimal change)

The ToolRunner public interface stays nearly identical. The only change is replacing `connectModifiers()` with deps-based injection at construction:

```typescript
interface ToolRunnerDeps {
  host: ToolRunnerHost;
  shared: SharedState;
  getShiftHeld: () => boolean;
}

function createToolRunner(deps: ToolRunnerDeps): ToolRunner;

interface ToolRunner {
  readonly isDrawing: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  drawStart(button: number): EditorEffects;
  draw(current: CanvasCoords, previous: CanvasCoords | null): EditorEffects;
  drawEnd(): EditorEffects;
  modifierChanged(): EditorEffects;
  undo(): EditorEffects;
  redo(): EditorEffects;
  clear(): EditorEffects;
  pushSnapshot(): void;
  // connectModifiers removed — shift provider injected via deps
}
```

### Internal architecture: StrokeLifecycle pattern

Each tool category provides a StrokeLifecycle — a strategy object that encapsulates its stroke policies (history, snapshot, draw behavior, modifier reaction). All four methods are mandatory; categories that don't respond to a given event return `NO_EFFECTS`.

```typescript
interface StrokeLifecycle {
  start(ctx: ToolContext): EditorEffects;
  draw(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): EditorEffects;
  modifierChanged(ctx: ToolContext): EditorEffects;
  end(): void;
}
```

Lifecycle methods receive the existing `ToolContext` type — no new parameter type needed.

ToolRunner resolves the lifecycle once at `drawStart()` and delegates blindly for the rest of the stroke:

```typescript
drawStart(button): EditorEffects {
  activeLifecycle = resolveLifecycle(tools[shared.activeTool]);
  return activeLifecycle.start(buildContext());
}

draw(current, previous): EditorEffects {
  return activeLifecycle.draw(buildContext(), current, previous);  // no switch
}
```

Four lifecycle factories encapsulate category-specific policies. Each receives the DrawTool instance and `pushHistorySnapshot` function:

- `continuousLifecycle(tool, pushHistory)` — pencil/eraser: interpolate pixels every frame
- `oneShotLifecycle(tool, pushHistory)` — floodfill/eyedropper: fire once, guard subsequent moves
- `shapePreviewLifecycle(tool, pushHistory)` — line/rect/ellipse: snapshot-restore-constrain-redraw cycle, shared `redraw()` eliminates duplication between draw and modifierChanged
- `dragTransformLifecycle(tool, pushHistory)` — move: snapshot-based delta transform

A new lifecycle closure is created on each `drawStart()`. Per-stroke state (snapshot, anchor, lastCurrent, fired) lives inside the closure and is automatically cleaned up when the lifecycle is discarded.

### Usage (EditorState)

EditorState call pattern is unchanged — `this.#applyEffects(this.#toolRunner.draw(...))`. Only the constructor changes: keep the current ToolRunner-first creation order, put the lazy ref on `getShiftHeld`:

```typescript
// Step 1: ToolRunner first (same order as today)
let keyboardRef: KeyboardInput | null = null;

this.#toolRunner = createToolRunner({
  host,
  shared: this.shared,
  getShiftHeld: () => keyboardRef?.isShiftHeld ?? false,  // lazy ref
});

// Step 2: KeyboardInput (toolRunner is initialized — callbacks are safe)
this.#keyboard = createKeyboardInput({
  isDrawing: () => this.#toolRunner.isDrawing,  // safe: toolRunner exists
  undo: () => this.handleUndo(),                 // safe: toolRunner exists
  // ...
});
keyboardRef = this.#keyboard;
```

The lazy ref is safe because `getShiftHeld` is only called during draw events, never during construction.

### What it hides

- Tool category dispatch (resolved once at stroke start, not per-frame)
- Stroke state (snapshot, anchor, lastCurrent) — owned by lifecycle closures, not ToolRunner fields
- Category-specific policies (history timing, snapshot capture, fired guard, shift constraint)
- Snapshot-restore cycle (single `redraw()` in shapePreviewLifecycle)

## Decision Document

### Dependency strategy

**In-process**: all dependencies are pure computation and in-memory state.

- DrawingOps: owned internally, created from host.pixelCanvas getter (no change)
- HistoryManager: owned internally, created in factory (no change)
- SharedState.activeTool: read via deps.shared (no change)
- ToolRunnerHost: read-only query interface from EditorState, kept as separate type (no change)
- Shift-key state: injected via `deps.getShiftHeld` at construction (replaces connectModifiers)
- Tool instances: owned internally, created in factory (no change)
- canvasFactory: imported directly for undo/redo dimension change (no change)

### Implementation decisions from interview

1. **History push ownership**: lifecycle factories own history push timing. Each factory receives `pushHistorySnapshot` as a parameter and calls it in `start()` according to the category's policy. ToolRunner does not inspect category metadata to decide when to push — this is fully encapsulated in the lifecycle.

2. **modifierChanged is mandatory**: all four lifecycle implementations provide `modifierChanged()`. Categories that don't respond (continuous, oneShot, dragTransform) return `NO_EFFECTS`. No optional method dispatch needed in ToolRunner.

3. **Lifecycle methods receive ToolContext**: the existing `ToolContext` type from `draw-tool.ts` is reused. No new `StrokeEnv` type needed — ToolContext already contains all fields lifecycle methods require (canvas, drawColor, drawButton, isShiftHeld, foregroundColor, backgroundColor).

4. **Lazy ref on getShiftHeld**: keep the current construction order (ToolRunner first, then KeyboardInput). The lazy ref is placed on `getShiftHeld` in ToolRunnerDeps, not on `isDrawing` in KeyboardInput. This ensures KeyboardInput callbacks always reference an initialized `#toolRunner`.

5. **Lifecycle created fresh per stroke**: `resolveLifecycle` creates a new closure on each `drawStart()`. Per-stroke state (snapshot, anchor, fired, lastCurrent) initializes automatically via closure creation — no explicit reset needed. `end()` sets large references (snapshot Uint8Array) to null for early GC.

6. **StrokeLifecycle stays internal**: the type and all lifecycle factories are defined inside `tool-runner.svelte.ts`, not exported. They are implementation details.

7. **Commit strategy**: two commits — (1) external API change (deps object, remove connectModifiers), (2) internal restructuring to lifecycle pattern. No gradual per-category migration — the file is small enough (285 LOC) for atomic internal replacement, and existing tests cover all categories.

## Commits

### Commit 1: refactor: replace connectModifiers with deps-based injection

**Purpose**: Change the factory signature and eliminate the two-pass initialization pattern. Pure external API change — no internal logic changes.

Changes in `tool-runner.svelte.ts`:

- Add `ToolRunnerDeps` interface: `{ host: ToolRunnerHost, shared: SharedState, getShiftHeld: () => boolean }`.
- Change `createToolRunner(host, shared)` signature to `createToolRunner(deps: ToolRunnerDeps)`.
- Inside the factory, destructure deps to get host, shared, getShiftHeld.
- Replace `shiftHeldProvider` internal state with direct `deps.getShiftHeld` usage in `buildContext()`.
- Remove `connectModifiers` from the ToolRunner interface and the returned object.
- Export `ToolRunnerDeps` type.

Changes in `editor-state.svelte.ts`:

- In the constructor, declare `let keyboardRef: KeyboardInput | null = null` before ToolRunner creation.
- Pass `getShiftHeld: () => keyboardRef?.isShiftHeld ?? false` in the deps object.
- Remove the `this.#toolRunner.connectModifiers(...)` call (Step 3 in current code).
- After KeyboardInput creation, assign `keyboardRef = this.#keyboard`.

Changes in `tool-runner.svelte.test.ts`:

- Update `createRunner` helper: pass a deps object to `createToolRunner` instead of positional args, remove `runner.connectModifiers(...)` call.
- Update direct `createToolRunner` calls in "canvasReplaced" test: same deps pattern.
- Rename "ToolRunner — connectModifiers" describe block to "ToolRunner — shift constraint" (behavior unchanged, wiring mechanism changed). Update test setup: pass `getShiftHeld` via deps instead of calling `connectModifiers`.

### Commit 2: refactor: encapsulate tool category logic into StrokeLifecycle pattern

**Purpose**: Replace the 4-way switch in draw/drawStart/modifierChanged with lifecycle delegation. Pure internal restructuring — no public API or test assertion changes.

Add internal types and functions in `tool-runner.svelte.ts`:

- Define `StrokeLifecycle` interface (not exported): `{ start, draw, modifierChanged, end }`.
- Implement `continuousLifecycle(tool: ContinuousTool, pushHistory: () => void): StrokeLifecycle`:
  - `start()`: call pushHistory, return addRecentColor effect if tool.addsActiveColor.
  - `draw()`: delegate to tool.apply(), return CANVAS_CHANGED or NO_EFFECTS.
  - `modifierChanged()`: return NO_EFFECTS.
  - `end()`: no-op.
- Implement `oneShotLifecycle(tool: OneShotTool, pushHistory: () => void): StrokeLifecycle`:
  - Closure state: `let fired = false`.
  - `start()`: call pushHistory if tool.capturesHistory, return addRecentColor if tool.addsActiveColor.
  - `draw()`: if fired, return NO_EFFECTS. Set fired = true, delegate to tool.execute().
  - `modifierChanged()`: return NO_EFFECTS.
  - `end()`: no-op (closure is discarded, fired resets on next stroke's new lifecycle).
- Implement `shapePreviewLifecycle(tool: ShapePreviewTool, pushHistory: () => void): StrokeLifecycle`:
  - Closure state: `snapshot: Uint8Array | null`, `anchor: CanvasCoords | null`, `lastCurrent: CanvasCoords | null`.
  - Internal `redraw(ctx)`: restore snapshot, apply shift constraint via `ctx.isShiftHeld()` and `tool.constrainFn`, call `tool.onPreview()`, return CANVAS_CHANGED. This single function replaces the duplicated logic in current `draw()` and `modifierChanged()`.
  - `start()`: call pushHistory, capture snapshot from ctx.canvas.pixels(), return addRecentColor if tool.addsActiveColor.
  - `draw()`: on first call (previous === null), set anchor and call tool.onAnchor(). On subsequent calls, store lastCurrent and call redraw().
  - `modifierChanged()`: if lastCurrent is null return NO_EFFECTS, otherwise call redraw().
  - `end()`: set snapshot, anchor, lastCurrent to null (early GC of snapshot buffer).
- Implement `dragTransformLifecycle(tool: DragTransformTool, pushHistory: () => void): StrokeLifecycle`:
  - Closure state: `snapshot: Uint8Array | null`, `anchor: CanvasCoords | null`.
  - `start()`: call pushHistory, capture snapshot. Return NO_EFFECTS (dragTransform has no addsActiveColor).
  - `draw()`: on first call (previous === null), set anchor, return NO_EFFECTS. On subsequent calls, delegate to tool.applyTransform() with snapshot, return CANVAS_CHANGED.
  - `modifierChanged()`: return NO_EFFECTS.
  - `end()`: set snapshot, anchor to null.
- Implement `resolveLifecycle(tool: DrawTool, pushHistory: () => void): StrokeLifecycle`: switch on `tool.kind`, dispatch to the corresponding factory.

Restructure ToolRunner's public methods:

- Add `let activeLifecycle: StrokeLifecycle | null = null` to the closure state.
- Remove module-level `strokeSnapshot`, `strokeAnchor`, `lastDrawCurrent` (moved into lifecycle closures).
- `drawStart()`: set isDrawing/drawButton/activeDrawColor as before. Call `activeLifecycle = resolveLifecycle(tools[shared.activeTool], pushHistorySnapshot)`. Return `activeLifecycle.start(buildContext())`.
- `draw()`: guard on `!isDrawing || !activeLifecycle`. Return `activeLifecycle.draw(buildContext(), current, previous)`.
- `modifierChanged()`: guard on `!isDrawing || !activeLifecycle`. Return `activeLifecycle.modifierChanged(buildContext())`.
- `drawEnd()`: guard on `!isDrawing || !activeLifecycle`. Call `activeLifecycle.end()`. Reset `activeLifecycle = null`, `isDrawing = false`, `drawButton = 0`, `activeDrawColor = null`. Return NO_EFFECTS.

No test file changes — all 26 existing tests verify behavior through the unchanged public API.

## Testing Decisions

### Philosophy

Test external behavior through the public interface, not internal structure. StrokeLifecycle is an implementation detail — testing it directly would couple tests to the internal pattern and make future refactoring harder.

### Existing tests (update, not delete)

- **`tool-runner.svelte.test.ts`** (26 tests, 513 LOC): update only in Commit 1 (factory helper and connectModifiers test setup). All assertions remain identical — they verify the same EditorEffects returns and canvas pixel states. No changes needed in Commit 2.
- **`editor-state.svelte.test.ts`** (85 tests, 1138 LOC): no changes expected. EditorState's public API is unchanged; its constructor internals change but tests don't inspect construction.

### What existing tests already cover

The 26 ToolRunner tests verify all category-specific behaviors that lifecycle factories will encapsulate:

- Pencil: canvasChanged + addRecentColor effects, pixel painting
- Eyedropper: colorPick effect, no canvasChanged, no history push
- Floodfill: fires once per stroke, ignores subsequent drags
- Shape (line): correct pixel placement, preview artifact cleanup
- Move: canvas content shift, canvasChanged effect
- Eraser: pixel erasure, no addRecentColor
- addsActiveColor: per-category flag behavior (5 tests)
- oneShot guard: second draw within stroke is no-op
- Right-click: uses background color
- History: push, undo, redo, clear, pushSnapshot, canvasReplaced on dimension change
- Guards: no-op when not drawing, no undo/redo while drawing
- Shift constraint: propagation to shape tool, mid-stroke toggle via modifierChanged

### No new tests

No lifecycle-level unit tests are added. The existing integration tests through ToolRunner's public API provide sufficient coverage for the refactoring. Adding lifecycle-level tests would test implementation details and become a maintenance burden when the internal structure changes again.

### Prior art

The existing test file follows a pattern of: create ToolRunner via helper, set tool via shared.activeTool, execute draw lifecycle (drawStart → draw → drawEnd), assert on EditorEffects and pixel state. This pattern is preserved.

## Out of Scope

- **DrawTool types** (`ContinuousTool`, `OneShotTool`, `ShapePreviewTool`, `DragTransformTool`): the 4-type discriminated union in `draw-tool.ts` is unchanged.
- **Tool implementations** (`tools/*.ts`): all 8 tool files remain as-is.
- **EditorState public API**: all handler methods (`handleDraw`, `handleUndo`, etc.) are unchanged. Only the constructor's internal initialization order changes.
- **KeyboardInput**: no changes to the module itself.
- **DrawingOps / WASM boundary**: no changes.
- **New tool categories or tools**: this refactoring restructures existing code, not adding features.
- **handleLongPress**: EditorState's long-press color pick bypasses ToolRunner and is a separate concern.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/tool-runner.svelte.ts` | Factory signature changed to `ToolRunnerDeps`, `connectModifiers` removed, internal 4-way switch replaced with StrokeLifecycle pattern (4 lifecycle factories + `resolveLifecycle`) |
| `src/lib/canvas/editor-state.svelte.ts` | Constructor updated: lazy ref on `getShiftHeld`, `connectModifiers` call removed |
| `src/lib/canvas/tool-runner.svelte.test.ts` | Test helpers updated for deps-based factory, "connectModifiers" describe renamed to "shift constraint" |

### Key Decisions

- Lifecycle factories own history push timing (via injected `pushHistorySnapshot`), not ToolRunner
- `modifierChanged()` is mandatory on all lifecycles (non-optional), with no-op returning `NO_EFFECTS`
- Lazy ref placed on `getShiftHeld` (not `isDrawing`) to keep current construction order and ensure keyboard callbacks always reference initialized `#toolRunner`
- Lifecycle methods receive existing `ToolContext` type — no new `StrokeEnv` type introduced

### Notes

- shapePreview's snapshot-restore duplication between `draw()` and `modifierChanged()` is eliminated via shared `redraw()` function inside `shapePreviewLifecycle`
- Public interface is unchanged except `connectModifiers` removal — all 449 tests pass without assertion changes
