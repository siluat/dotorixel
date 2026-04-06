---
title: Deepen tool system — discriminated union with category-managed lifecycle
status: done
created: 2026-04-06
---

## Problem

The `DrawTool` interface (`draw-tool.ts`) is a shallow, one-size-fits-all contract that forces 4 distinct tool categories into a single lifecycle shape:

| Category | Tools | What the interface wastes |
|----------|-------|--------------------------|
| Continuous stroke | pencil, eraser | Empty `onDrawEnd`, unused `onModifierChange` |
| Shape preview | line, rect, ellipse | Only users of `onModifierChange`; must manage snapshot/anchor closure state manually |
| One-shot | floodfill, eyedropper | Empty `onDrawEnd`; must guard with `previous !== null` protocol |
| Drag transform | move | Must manage snapshot/anchor closure state manually |

Specific friction points:

1. **`capturesHistory` is external.** ToolRunner checks `tool.capturesHistory` and pushes a snapshot before the stroke. Tools cannot express conditional history (e.g., "only if changed").

2. **Closure state leak risk.** Shape and move tools store `shapeStart`, `previewSnapshot`, `moveStart`, `moveSnapshot` in closures. Forgetting to null them in `onDrawEnd` leaks state across strokes.

3. **`previous === null` implicit protocol.** One-shot tools must know that `previous === null` signals the first draw event and guard accordingly. This is undocumented tribal knowledge.

4. **`addRecentColor` duplicated in 3 places.** Pencil, shape, and floodfill tools each independently construct the same `addRecentColor` effect in `onDrawStart`.

5. **`onModifierChange` is optional baggage.** Only shape tools use it. ToolRunner checks `if (!tool.onModifierChange)` at runtime. Every other tool carries this unused slot.

## Proposed Interface

Replace the single `DrawTool` interface with a discriminated union of 4 category-specific types. Each type declares only what that category needs.

### Type definitions

```typescript
type DrawTool =
  | ContinuousTool
  | OneShotTool
  | ShapePreviewTool
  | DragTransformTool;

interface ContinuousTool {
  readonly kind: 'continuous';
  readonly addsActiveColor: boolean;
  apply(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): boolean;
}

interface OneShotTool {
  readonly kind: 'oneShot';
  readonly capturesHistory: boolean;
  readonly addsActiveColor: boolean;
  execute(ctx: ToolContext, target: CanvasCoords): ToolEffects;
}

interface ShapePreviewTool {
  readonly kind: 'shapePreview';
  readonly addsActiveColor: boolean;
  readonly constrainFn: (start: CanvasCoords, end: CanvasCoords) => CanvasCoords;
  onAnchor(ctx: ToolContext, start: CanvasCoords): void;
  onPreview(ctx: ToolContext, start: CanvasCoords, end: CanvasCoords): void;
}

interface DragTransformTool {
  readonly kind: 'dragTransform';
  applyTransform(ctx: ToolContext, snapshot: Uint8Array, start: CanvasCoords, current: CanvasCoords): void;
}
```

### Usage examples

**pencilTool (continuous)** — `apply` returns boolean; framework wraps to effects:

```typescript
const pencilTool: ContinuousTool = {
  kind: 'continuous',
  addsActiveColor: true,
  apply(ctx, current, previous) {
    if (previous) {
      const flat = wasm_interpolate_pixels(previous.x, previous.y, current.x, current.y);
      let changed = false;
      for (let i = 0; i < flat.length; i += 2) {
        if (apply_tool(ctx.canvas, flat[i], flat[i + 1], WasmToolType.Pencil, ctx.drawColor)) changed = true;
      }
      return changed;
    }
    return apply_tool(ctx.canvas, current.x, current.y, WasmToolType.Pencil, ctx.drawColor);
  }
};
```

**eyedropperTool (oneShot)** — `execute` called exactly once per click:

```typescript
const eyedropperTool: OneShotTool = {
  kind: 'oneShot',
  capturesHistory: false,
  addsActiveColor: false,
  execute(ctx, target) {
    const pixel = ctx.canvas.get_pixel(target.x, target.y);
    if (pixel.a === 0) return NO_EFFECTS;
    const color = { r: pixel.r, g: pixel.g, b: pixel.b, a: pixel.a };
    return [
      { type: 'colorPick', target: ctx.drawButton === 2 ? 'background' : 'foreground', color },
      { type: 'addRecentColor', hex: colorToHex(color) }
    ];
  }
};
```

**lineTool (shapePreview)** — no closure state; framework manages snapshot/anchor:

```typescript
const lineTool: ShapePreviewTool = createShapeTool(WasmToolType.Line, wasm_interpolate_pixels, constrainLine);
// createShapeTool returns { kind: 'shapePreview', addsActiveColor: true, constrainFn, onAnchor, onPreview }
```

**moveTool (dragTransform)** — plain object, no factory needed:

```typescript
const moveTool: DragTransformTool = {
  kind: 'dragTransform',
  applyTransform(ctx, snapshot, start, current) {
    const shifted = shiftPixels(snapshot, ctx.canvas.width, ctx.canvas.height,
      current.x - start.x, current.y - start.y);
    ctx.canvas.restore_pixels(shifted);
  }
};
```

### What ToolRunner hides internally

ToolRunner manages all per-stroke state (`strokeSnapshot`, `strokeAnchor`, `oneShotFired`) and runs a `switch (tool.kind)` dispatch:

| Concern | Before (tool handles) | After (ToolRunner handles) |
|---------|----------------------|---------------------------|
| History snapshot | `capturesHistory` flag, ToolRunner checks | Category determines policy (continuous/shape/drag = always; oneShot = flag) |
| addRecentColor | 3 tools duplicate `colorToHex` + effect | Declarative `addsActiveColor` flag; ToolRunner emits once in `drawStart` |
| Snapshot save/restore | Shape/move closures manage `previewSnapshot` | ToolRunner owns `strokeSnapshot`, restores before `onPreview`/`applyTransform` |
| Anchor tracking | Shape/move closures manage `shapeStart`/`moveStart` | ToolRunner owns `strokeAnchor` |
| First-click detection | `previous === null` protocol | `oneShot`: `oneShotFired` flag; others: `strokeAnchor` set on first draw |
| Shift constraint | Shape tools call `constrainFn` internally | ToolRunner applies `constrainFn` and passes constrained coords to `onPreview` |
| Cleanup | Each tool nulls closure vars in `onDrawEnd` | ToolRunner zeroes all stroke state in `drawEnd` |
| Modifier dispatch | Runtime `tool.onModifierChange?` check | `tool.kind === 'shapePreview'` compile-time narrowing |

## Decision Document

### Dependency category

**In-process.** All modules involved (draw-tool types, tool implementations, ToolRunner) are pure computation and in-memory state with no I/O. The deepening merges lifecycle management into ToolRunner and simplifies tool implementations — no adapters or substitutes needed.

### Migration strategy: atomic (no adapter)

All 8 tools and ToolRunner dispatch convert in a single commit. An adapter pattern was considered but rejected: the old-to-new mapping per category is nearly as complex as the ToolRunner dispatch itself, making the temporary code not worth the cost. The 94 existing ToolRunner + EditorState tests (which call the unchanged public API) serve as the safety net.

### Return type policy

Each category's method returns the simplest type that carries sufficient information:

| Method | Returns | Why |
|--------|---------|-----|
| `ContinuousTool.apply` | `boolean` | Only signal needed is "did pixels change?" — ToolRunner wraps to `CANVAS_CHANGED` |
| `OneShotTool.execute` | `ToolEffects` | Produces varied effects (`colorPick`, `addRecentColor`, `canvasChanged`) |
| `ShapePreviewTool.onAnchor` | `void` | Always stamps a pixel; ToolRunner emits `CANVAS_CHANGED` unconditionally |
| `ShapePreviewTool.onPreview` | `void` | Always redraws shape; ToolRunner emits `CANVAS_CHANGED` unconditionally |
| `DragTransformTool.applyTransform` | `void` | Always transforms canvas; ToolRunner emits `CANVAS_CHANGED` unconditionally |

Shape and drag tools do not import `CANVAS_CHANGED` or `NO_EFFECTS` — they are pure pixel-painting functions.

### `addsActiveColor` flag semantics

The flag is named `addsActiveColor` (not `addsRecentColor`) to distinguish from tools that add a *different* color. Eyedropper adds the *sampled* color — it sets `addsActiveColor: false` and emits its own `addRecentColor` effect inside `execute`. ToolRunner emits `addRecentColor` for the drawing color in `drawStart` only when the flag is true.

`DragTransformTool` does not carry `addsActiveColor` — the move tool does not add recent colors. If a future drag tool needs this, add the flag then (YAGNI).

### History capture policy

Encoded by category, not by a universal flag:

- `continuous`, `shapePreview`, `dragTransform`: always push history snapshot before stroke.
- `oneShot`: controlled by `capturesHistory` field (eyedropper = false, floodfill = true).

### ToolRunner stroke state ownership

ToolRunner owns all per-stroke state and zeroes it in `drawEnd`:

- `strokeSnapshot: Uint8Array | null` — captured in `drawStart` for shape and drag categories
- `strokeAnchor: CanvasCoords | null` — set on first `draw` event for shape, drag, and oneShot
- `lastDrawCurrent: CanvasCoords | null` — tracked for `modifierChanged` forwarding

No tool implementation holds mutable closure state. Cleanup-on-end is guaranteed by ToolRunner, eliminating the state-leak bug class.

### Modifier dispatch

Only `shapePreview` tools respond to `modifierChanged`. ToolRunner checks `tool.kind === 'shapePreview'` (compile-time narrowing via discriminated union), then restores the snapshot, applies `tool.constrainFn` when shift is held, and calls `tool.onPreview` with the constrained endpoint.

### What stays unchanged

- `ToolContext` interface (including `isShiftHeld` callback — shape tools no longer use it internally, but removing it requires touching all ToolContext consumers, which is out of scope)
- `ToolEffect`, `RunnerEffect`, `EditorEffect` types
- `EditorState` code and its public API
- `connectModifiers()` pattern for circular dependency resolution
- Pure function modules (`constrain.ts`, `shift-pixels.ts`, `color.ts`)
- WASM bindings

## Commits

### Commit 1: refactor — replace DrawTool interface with discriminated union

This is the main refactoring commit. It changes the tool type system and ToolRunner dispatch while preserving all external behavior. ToolRunner's public API (`drawStart`/`draw`/`drawEnd`/`modifierChanged`/`undo`/`redo`/`clear`) is unchanged.

**draw-tool.ts:**

- Remove the old `DrawTool` interface (the `onDrawStart`/`onDraw`/`onDrawEnd`/`onModifierChange` shape).
- Define the 4 category interfaces (`ContinuousTool`, `OneShotTool`, `ShapePreviewTool`, `DragTransformTool`) and the `DrawTool` discriminated union type.
- Export all category interfaces so tool files can type their exports.
- Keep `ToolContext`, `ToolEffect`, `ToolEffects`, `CANVAS_CHANGED`, `NO_EFFECTS` unchanged.

**pencil-tool.ts:**

- Change `createFreehandTool` return type from `DrawTool` to `ContinuousTool`.
- Replace `onDrawStart` with `addsActiveColor` flag. Pencil = true, eraser = false.
- Rename `onDraw` to `apply`, change return from `ToolEffects` to `boolean`. Remove `CANVAS_CHANGED`/`NO_EFFECTS` wrapping — just return whether `apply_tool` changed any pixel.
- Remove empty `onDrawEnd`.
- Remove `capturesHistory` field (continuous tools always capture; ToolRunner handles this).

**eyedropper-tool.ts:**

- Change type from `DrawTool` to `OneShotTool`.
- Replace `onDraw` with `execute`. Remove the `if (previous !== null) return NO_EFFECTS` guard — ToolRunner guarantees `execute` is called exactly once.
- Remove empty `onDrawStart` and `onDrawEnd`.
- Add `capturesHistory: false` and `addsActiveColor: false` fields.

**floodfill-tool.ts:**

- Change type from `DrawTool` to `OneShotTool`.
- Replace `onDraw` with `execute`. Remove the `if (previous !== null) return NO_EFFECTS` guard.
- Move the `addRecentColor` logic from `onDrawStart` to `addsActiveColor: true` flag.
- Remove empty `onDrawEnd`.
- Add `capturesHistory: true`.

**shape-tool.ts:**

- Change `createShapeTool` return type from `DrawTool` to `ShapePreviewTool`.
- Remove closure state (`shapeStart`, `previewSnapshot`) — ToolRunner manages these.
- Remove `onDrawStart` — recent color handled by `addsActiveColor: true`.
- Remove the internal `drawShape` helper that did restore + draw. Replace with `onAnchor` (stamps first pixel, returns void) and `onPreview` (draws shape from start to end, returns void). Neither does snapshot-restore — ToolRunner handles that before calling.
- Remove `onModifierChange` — ToolRunner calls `onPreview` with constrained coords.
- Remove empty `onDrawEnd`.
- Expose `constrainFn` as a property.
- Remove `capturesHistory` field.

**move-tool.ts:**

- Change from factory `createMoveTool()` to plain object constant `moveTool`.
- Change type from `DrawTool` to `DragTransformTool`.
- Replace `onDraw` with `applyTransform(ctx, snapshot, start, current)`. Remove closure state (`moveStart`, `moveSnapshot`) — ToolRunner provides `snapshot` and `start` as arguments.
- Remove empty-ish `onDrawStart` (only captured snapshot, which ToolRunner now does).
- Remove `onDrawEnd` (only nulled closure state, which no longer exists).
- Remove `capturesHistory` field.

**tool-runner.svelte.ts:**

- Add stroke state variables: `strokeSnapshot`, `strokeAnchor`, `lastDrawCurrent` (rename from existing if needed). These are ToolRunner-private, zeroed in `drawEnd`.
- Update `drawStart`: push history based on category policy, emit `addRecentColor` if `addsActiveColor` is true, capture `strokeSnapshot` for shape/drag.
- Rewrite `draw` as a `switch (tool.kind)`:
  - `continuous`: call `tool.apply`, return `CANVAS_CHANGED` if true.
  - `oneShot`: if `strokeAnchor` already set, return `NO_EFFECTS` (already fired). Otherwise set `strokeAnchor` as fired-marker, call `tool.execute`.
  - `shapePreview`: if first draw (`previous === null`), set `strokeAnchor`, call `tool.onAnchor`, return `CANVAS_CHANGED`. Otherwise restore `strokeSnapshot`, apply constraint if shift held, call `tool.onPreview`, return `CANVAS_CHANGED`.
  - `dragTransform`: if first draw, set `strokeAnchor`, return `NO_EFFECTS`. Otherwise restore `strokeSnapshot`, call `tool.applyTransform`, return `CANVAS_CHANGED`.
- Simplify `drawEnd`: just reset all state, no tool callback.
- Rewrite `modifierChanged`: only respond when `tool.kind === 'shapePreview'`, restore snapshot, apply constraint, call `onPreview`.
- Update tool registry type from `Record<ToolType, DrawTool>` (old interface) to the new union type.

**Delete per-tool test files** (they call the removed DrawTool method names):

- `tools/pencil-tool.test.ts`
- `tools/shape-tool.test.ts`
- `tools/floodfill-tool.test.ts`
- `tools/eyedropper-tool.test.ts`
- `tools/move-tool.test.ts`

**Verification:** All existing ToolRunner tests (22) and EditorState tests (72) must pass without changes, since ToolRunner's public API and observable behavior are preserved.

### Commit 2: test — augment ToolRunner boundary tests

Add tests to `tool-runner.svelte.test.ts` to cover behaviors that were previously only verified in the now-deleted per-tool test files:

1. **Eraser behavior.** Verify that drawing with the eraser tool sets pixels to transparent. Previously only tested in `pencil-tool.test.ts`.

2. **`addsActiveColor` flag.** Verify that `drawStart` returns an `addRecentColor` effect for tools with `addsActiveColor: true` (pencil, floodfill, line) and does NOT return one for tools with `addsActiveColor: false` (eraser, eyedropper). Verify the emitted hex matches the active drawing color (foreground for left-click, background for right-click).

3. **OneShot second-draw guard.** Verify that after a oneShot tool's first draw, subsequent `draw` calls within the same stroke return `NO_EFFECTS` and do not call `execute` again. Previously implicitly tested in `floodfill-tool.test.ts`.

## Testing Decisions

### What makes a good test here

Tests should assert on **ToolRunner's public API behavior** — the effects returned by `drawStart`/`draw`/`drawEnd`/`modifierChanged` and the resulting pixel state on the canvas. Tests should NOT assert on:

- Which category a tool belongs to (implementation detail)
- Whether ToolRunner internally calls `tool.apply` vs `tool.execute` (implementation detail)
- The order of internal state operations (snapshot capture timing, etc.)

A test should survive internal ToolRunner refactoring as long as the external behavior is preserved.

### Test file structure

All tool-related tests live in `tool-runner.svelte.test.ts`. This single file tests the ToolRunner boundary, which is the module's public interface. No per-tool test files exist.

Algorithm-level correctness (pixel interpolation, geometric constraints, pixel shifting) is tested in separate dedicated files: `wasm-tool.test.ts`, `constrain.test.ts`, `shift-pixels.test.ts`. These are unaffected by this refactoring.

### Prior art

The existing `tool-runner.svelte.test.ts` uses these patterns:

- Create `ToolRunner` via `createToolRunner(host, shared)` with a real `WasmPixelCanvas`
- Call `runner.drawStart(button)` → `runner.draw(coord, previous)` → `runner.drawEnd()`
- Assert on returned `EditorEffects` using `hasEffect()` and `findEffect()` helpers
- Assert on pixel state using `getPixel(canvas, x, y)` helper
- Use `shared.activeTool = 'toolName'` to switch tools between tests

New tests should follow this exact pattern.

## Out of Scope

- **`ToolContext` changes.** `isShiftHeld` callback remains even though shape tools no longer use it internally. Removing it would touch all `ToolContext` consumers and is a separate concern.
- **`ToolEffect` type extensions.** No new effect variants are introduced (e.g., no `pushHistory` effect).
- **EditorState refactoring.** ToolRunner's public API is unchanged, so EditorState code and tests are untouched.
- **EditorState ↔ ToolRunner ↔ KeyboardInput circular dependency.** The `connectModifiers()` late-binding pattern remains. This is a separate architectural improvement (candidate #1 from the architecture exploration).
- **Rendering pipeline changes.** No changes to how `renderVersion` or canvas rendering works.
- **WASM binding layer.** Tools continue to import WASM functions directly.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/draw-tool.ts` | Replaced single DrawTool interface with 4-category discriminated union |
| `src/lib/canvas/tools/pencil-tool.ts` | Converted to ContinuousTool; apply() returns boolean |
| `src/lib/canvas/tools/eyedropper-tool.ts` | Converted to OneShotTool; execute() called once per click |
| `src/lib/canvas/tools/floodfill-tool.ts` | Converted to OneShotTool with addsActiveColor flag |
| `src/lib/canvas/tools/shape-tool.ts` | Converted to ShapePreviewTool; closure state eliminated |
| `src/lib/canvas/tools/move-tool.ts` | Converted to DragTransformTool; plain object, no factory |
| `src/lib/canvas/tool-runner.svelte.ts` | switch(tool.kind) dispatch; owns stroke state, addsActiveColor auto-emission |
| `src/lib/canvas/tool-runner.svelte.test.ts` | Added 8 boundary tests (eraser, addsActiveColor, oneShot guard) |

### Key Decisions

- Atomic migration (no adapter pattern) — the 94 existing ToolRunner + EditorState tests served as the safety net
- Per-tool test files deleted (37 tests) — behaviors already covered by ToolRunner/EditorState boundary tests; 8 new tests added for gaps
- Shape/drag tools return void, not ToolEffects — ToolRunner emits canvasChanged unconditionally
- dragTransform does not get ToolRunner-managed restore_pixels — the tool owns the full transform including pixel write

### Notes

- `ToolContext.isShiftHeld` callback remains unused by shape tools but was kept to avoid scope creep
- Net code reduction: 269 lines removed across the system
- Test count: 455 → 426 (37 deleted, 8 added) with equivalent coverage
