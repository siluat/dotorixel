# 026 — Tool Handler strategy pattern refactoring

## Plan

### Context

`EditorState.handleDraw()` concentrates branching logic for 7 tools in an if-chain. As tools are added, branches grow. The 3 shape tools (line/rectangle/ellipse) repeat the snapshot-restore pattern almost identically. Per-tool state (`#shapeStart`, `#previewSnapshot`) is mixed into EditorState, reducing cohesion.

Goal: Extract per-tool logic into a ToolHandler interface, making EditorState a pure delegator, so adding a new tool only requires registering a handler.

### Design

#### New file: `src/lib/canvas/tool-handler.ts`

**ToolContext** — exposes only what handlers need from EditorState:

```typescript
export interface ToolContext {
  readonly pixelCanvas: WasmPixelCanvas;
  readonly drawColor: WasmColor;          // current foreground color (for WASM API)
  setForegroundColor(color: Color): void; // change foreground color (eyedropper)
  addToRecentColors(hex: string): void;   // add to recent colors (eyedropper)
  markChanged(): void;                    // increment renderVersion
}
```

**ToolHandler** — declarative properties + draw logic:

```typescript
export interface ToolHandler {
  readonly pushesUndo: boolean;   // whether to push undo snapshot
  readonly tracksColor: boolean;  // whether to add foreground color to recentColors on drawStart
  onDrawStart?(ctx: ToolContext): void;
  onDraw(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): void;
  onDrawEnd?(): void;
}
```

Declarative properties (`pushesUndo`, `tracksColor`) completely eliminate tool-name branching in `handleDrawStart`.

#### Handler implementations

| Handler | Tools | Form | State |
|---|---|---|---|
| `StrokeHandler` | pencil, eraser | class (WasmToolType + tracksColor param) | stateless |
| `ShapeHandler` | line, rectangle, ellipse | class (WasmToolType + pixel generation fn param) | `#shapeStart`, `#previewSnapshot` |
| floodfillHandler | floodfill | object literal | stateless |
| eyedropperHandler | eyedropper | object literal | stateless |

- **StrokeHandler**: shared by pencil/eraser. `onDraw` uses `apply_tool` + `wasm_interpolate_pixels` for interpolation.
- **ShapeHandler**: `onDrawStart` captures preview snapshot. `onDraw(first)` saves shapeStart + draws single pixel. `onDraw(drag)` restores snapshot → generates shape pixels → apply_tool. `onDrawEnd` resets state.
- **floodfillHandler**: responds to first click only, calls `wasm_flood_fill`.
- **eyedropperHandler**: responds to first click only, reads pixel → `setForegroundColor` → `addToRecentColors`. Computes hex from picked color directly (`colorToHex` imported from `./color`).

Shape tool pixel generation functions:
- line → `wasm_interpolate_pixels`
- rectangle → `wasm_rectangle_outline`
- ellipse → `wasm_ellipse_outline`

#### Registry

```typescript
export const TOOL_HANDLERS: Record<ToolType, ToolHandler> = {
  pencil:     new StrokeHandler(WasmToolType.Pencil, true),
  eraser:     new StrokeHandler(WasmToolType.Eraser, false),
  line:       new ShapeHandler(WasmToolType.Line, wasm_interpolate_pixels),
  rectangle:  new ShapeHandler(WasmToolType.Rectangle, wasm_rectangle_outline),
  ellipse:    new ShapeHandler(WasmToolType.Ellipse, wasm_ellipse_outline),
  floodfill:  floodfillHandler,
  eyedropper: eyedropperHandler,
};
```

Module-level singletons. ShapeHandler's per-gesture state is reinitialized in `onDrawStart` each time.

#### EditorState changes

**`handleDrawStart`** — remove tool-name branching, replace with declarative properties:

```typescript
handleDrawStart = (): void => {
  this.#isDrawing = true;
  const handler = TOOL_HANDLERS[this.activeTool];
  if (handler.pushesUndo) {
    this.#history.push_snapshot(this.pixelCanvas.pixels());
    this.#historyVersion++;
  }
  if (handler.tracksColor) {
    this.recentColors = addRecentColor(this.recentColors, colorToHex(this.foregroundColor));
  }
  handler.onDrawStart?.(this.#toolContext());
};
```

**`handleDraw`** — single delegation:

```typescript
handleDraw = (current: CanvasCoords, previous: CanvasCoords | null): void => {
  TOOL_HANDLERS[this.activeTool].onDraw(this.#toolContext(), current, previous);
};
```

**`handleDrawEnd`** — single delegation:

```typescript
handleDrawEnd = (): void => {
  this.#isDrawing = false;
  TOOL_HANDLERS[this.activeTool].onDrawEnd?.();
};
```

**`#toolContext()`** — new private helper:

```typescript
#toolContext(): ToolContext {
  return {
    pixelCanvas: this.pixelCanvas,
    drawColor: this.#wasmForegroundColor,
    setForegroundColor: (color) => { this.foregroundColor = color; },
    addToRecentColors: (hex) => { this.recentColors = addRecentColor(this.recentColors, hex); },
    markChanged: () => { this.renderVersion++; },
  };
}
```

#### Removed from EditorState

- `#shapeStart`, `#previewSnapshot` (→ ShapeHandler instance fields)
- `#handleLineDraw()`, `#handleRectangleDraw()`, `#handleEllipseDraw()` (→ ShapeHandler.onDraw)
- `WASM_TOOL_MAP` constant (→ inlined in handler constructors)
- Entire if-chain in `handleDraw` (→ handler dispatch)
- Tool-name conditionals in `handleDrawStart` (→ declarative properties)

#### Retained in EditorState

- History management (push/undo/redo) — determined by `pushesUndo` flag
- `recentColors` update (on drawStart) — determined by `tracksColor` flag
- `#isDrawing` flag — gesture lifecycle
- Viewport, zoom, grid, export, and other tool-independent features

### Implementation order

1. Create `src/lib/canvas/tool-handler.ts` — interfaces + all handlers + registry
2. Modify `src/lib/canvas/editor-state.svelte.ts` — add `#toolContext()`, change `handleDrawStart`/`handleDraw`/`handleDrawEnd` to delegation, delete removed code
3. Verify existing tests pass

### Verification

- `bun run test` — all existing tests in `editor-state.svelte.test.ts` must pass unchanged
- `bun run check` — TypeScript type check passes
- `bun run dev` — manual verification of each tool in dev server (pencil, eraser, line, rectangle, ellipse, floodfill, eyedropper)

### Related files

| File | Change |
|---|---|
| `src/lib/canvas/tool-handler.ts` | New |
| `src/lib/canvas/editor-state.svelte.ts` | Major modification (~80 lines removed, delegation logic added) |
| `src/lib/canvas/tool-types.ts` | No change |
| `src/lib/canvas/view-types.ts` | No change (CanvasCoords import) |
| `src/lib/canvas/color.ts` | No change (colorToHex, Color import) |
| `src/lib/canvas/editor-state.svelte.test.ts` | No change (existing tests pass as-is) |

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/shape-handler.ts` | New — ShapeHandler class encapsulating snapshot-restore preview cycle |
| `src/lib/canvas/editor-state.svelte.ts` | Replaced 3 duplicate shape methods with ShapeHandler delegation |

### Key Decisions

- Rejected full Strategy Pattern (ToolHandler interface + ToolContext + registry) in favor of extracting only ShapeHandler. The full pattern added 3 abstraction layers (2 interfaces + registry) for 7 tools, with ToolContext creating a coupling surface that would need widening as tools grow. ShapeHandler alone eliminates the genuine duplication (3 near-identical ~30-line methods) without unnecessary indirection.
- Simple tools (pencil/eraser stroke, floodfill, eyedropper) remain as inline logic in EditorState — they share no code and are individually small enough to understand in place.
- Removed `WASM_TOOL_MAP` constant; pencil/eraser now use an inline ternary since only 2 entries remain.
- Simplified `handleDrawStart` recentColors condition from 5-tool enumeration to `!== 'eraser'` (eyedropper already returns early).
