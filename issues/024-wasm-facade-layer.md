---
title: Introduce WASM facade layer — structural typing + DrawingOps injection
status: done
created: 2026-04-07
---

## Problem

25+ files directly import from `$wasm/dotorixel_wasm`, creating tight coupling between application logic and the WASM implementation:

- **Type leakage**: Concrete WASM types (`WasmPixelCanvas`, `WasmViewport`, `WasmColor`) appear in domain interfaces (`ToolContext`, `ViewportState`), making it impossible to test core logic without WASM.
- **Enum boilerplate**: `WasmResizeAnchor` requires a 9-entry mapping table in `editor-state.svelte.ts`. `WasmToolType` is imported in every tool file.
- **WasmColor ceremony**: `tool-runner.svelte.ts` maintains `$derived` WasmColor instances that mirror plain `Color` objects. Every foreground color change triggers a WasmColor construction.
- **Test brittleness**: All consumer tests require WASM initialization (`setup.ts`), coupling test execution to the Rust toolchain and WASM binary freshness.
- **Change amplification**: A WASM API rename ripples across 25 files instead of one.

## Proposed Interface

Hybrid of structural typing and DrawingOps injection:

### Principle

- **Instance methods on primitive-only signatures**: Define TypeScript interfaces that WASM classes already satisfy structurally. Zero runtime wrapping.
- **Static methods and free functions**: Wrap in factory objects, ops objects, and `DrawingOps` interface — the only runtime indirection.
- **WASM-typed parameters**: `set_pixel` and `resize_with_anchor` are excluded from `PixelCanvas` interface (no production callers use `set_pixel` directly; `resize_with_anchor` moves to `CanvasFactory`). This allows `WasmPixelCanvas` to satisfy `PixelCanvas` structurally without wrapping.

### Core interfaces

```typescript
// pixel-canvas.ts — WasmPixelCanvas satisfies this structurally
// set_pixel and resize_with_anchor excluded: no production code calls set_pixel directly
// (all pixel mutations go through DrawingOps), resize_with_anchor handled by CanvasFactory.
interface PixelCanvas {
  readonly width: number;
  readonly height: number;
  pixels(): Uint8Array;
  get_pixel(x: number, y: number): Color;  // WasmColor satisfies Color structurally
  restore_pixels(data: Uint8Array): void;
  is_inside_bounds(x: number, y: number): boolean;
  clear(): void;
  encode_png(): Uint8Array;
  resize(new_width: number, new_height: number): PixelCanvas;
}

// viewport.ts — WasmViewport satisfies this structurally (all params are primitives)
interface Viewport {
  readonly pixel_size: number;
  readonly zoom: number;
  readonly pan_x: number;
  readonly pan_y: number;
  effective_pixel_size(): number;
  screen_to_canvas(screen_x: number, screen_y: number): CanvasCoords;
  display_size(canvas_width: number, canvas_height: number): ViewportSize;
  zoom_at_point(screen_x: number, screen_y: number, new_zoom: number): Viewport;
  pan(delta_x: number, delta_y: number): Viewport;
  clamp_pan(cw: number, ch: number, vw: number, vh: number): Viewport;
  fit_to_viewport(cw: number, ch: number, vw: number, vh: number, max_zoom: number): Viewport;
}

// history.ts — WasmHistoryManager satisfies this structurally (all params are primitives)
interface HistoryManager {
  can_undo(): boolean;
  can_redo(): boolean;
  clear(): void;
  push_snapshot(width: number, height: number, pixels: Uint8Array): void;
  undo(cw: number, ch: number, cp: Uint8Array): Snapshot | undefined;
  redo(cw: number, ch: number, cp: Uint8Array): Snapshot | undefined;
}

// drawing-ops.ts — DrawingOps captures canvas getter in closure, no canvas parameter.
// DrawingToolType is a string literal union: 'pencil' | 'eraser' | 'line' | 'rectangle' | 'ellipse'
interface DrawingOps {
  applyTool(x: number, y: number, tool: DrawingToolType, color: Color): boolean;
  floodFill(x: number, y: number, color: Color): boolean;
  interpolatePixels(x0: number, y0: number, x1: number, y1: number): Int32Array;
  rectangleOutline(x0: number, y0: number, x1: number, y1: number): Int32Array;
  ellipseOutline(x0: number, y0: number, x1: number, y1: number): Int32Array;
}
```

### Factory and ops interfaces (for static methods)

Creation is separated from pure utility operations — "Factory" creates instances, "Ops"/"Constraints" are pure functions and constants.

```typescript
// canvas-factory.ts — creates and transforms PixelCanvas instances
interface CanvasFactory {
  create(width: number, height: number): PixelCanvas;
  fromPixels(width: number, height: number, pixels: Uint8Array): PixelCanvas;
  withColor(width: number, height: number, color: Color): PixelCanvas;
  resizeWithAnchor(canvas: PixelCanvas, newWidth: number, newHeight: number, anchor: ResizeAnchor): PixelCanvas;
}

// canvas-constraints.ts — dimension validation and presets (no instances created)
interface CanvasConstraints {
  readonly minDimension: number;
  readonly maxDimension: number;
  isValidDimension(value: number): boolean;
  presets(): number[];
}

// viewport-factory.ts — creates Viewport instances
interface ViewportFactory {
  create(pixelSize: number, zoom: number, panX: number, panY: number): Viewport;
  forCanvas(canvasWidth: number, canvasHeight: number): Viewport;
}

// viewport-ops.ts — zoom arithmetic and viewport constants (no instances created)
interface ViewportOps {
  clampZoom(zoom: number): number;
  computePinchZoom(currentZoom: number, deltaY: number): number;
  nextZoomLevel(currentZoom: number): number;
  prevZoomLevel(currentZoom: number): number;
  defaultPixelSize(canvasWidth: number, canvasHeight: number): number;
  zoomLevels(): number[];
  readonly minZoom: number;
  readonly maxZoom: number;
}
```

### Usage example

```typescript
// Before (editor-state.svelte.ts)
import { WasmPixelCanvas, WasmViewport, WasmResizeAnchor } from '$wasm/dotorixel_wasm';
const RESIZE_ANCHOR_MAP: Record<ResizeAnchor, WasmResizeAnchor> = { /* 9 entries */ };
this.pixelCanvas = new WasmPixelCanvas(cw, ch);
const newZoom = WasmViewport.next_zoom_level(viewport.zoom);

// After
import type { PixelCanvas } from './pixel-canvas';
import { canvasFactory, viewportFactory, viewportOps } from './wasm-backend';
this.pixelCanvas = canvasFactory.create(cw, ch);
const newZoom = viewportOps.nextZoomLevel(viewport.zoom);
// RESIZE_ANCHOR_MAP eliminated — canvasFactory.resizeWithAnchor handles it

// Before (pencil-tool.ts)
import { WasmToolType, apply_tool, wasm_interpolate_pixels } from '$wasm/dotorixel_wasm';
apply_tool(ctx.canvas, flat[i], flat[i + 1], WasmToolType.Pencil, ctx.drawColor);

// After — DrawingOps injected, no WASM import
ops.applyTool(flat[i], flat[i + 1], 'pencil', ctx.drawColor);
```

### What it hides internally

- WASM module path (`$wasm/dotorixel_wasm`) — appears in exactly 1 production file (`wasm-backend.ts`)
- `WasmColor` construction/destruction — `DrawingOps` accepts plain `Color`, converts at the WASM boundary
- `WasmResizeAnchor` enum mapping — `canvasFactory.resizeWithAnchor` handles it internally
- `WasmToolType` enum — `DrawingOps` uses `DrawingToolType` string literal union
- Static method access patterns — consolidated into `CanvasFactory`, `CanvasConstraints`, `ViewportFactory`, and `ViewportOps`

## Decision Document

### PixelCanvas interface excludes `set_pixel` and `resize_with_anchor`

No production code calls `set_pixel` directly — all pixel mutations go through `apply_tool()` (WASM free function), which is wrapped by `DrawingOps`. The only direct `set_pixel` calls are in story files (data setup). `resize_with_anchor` takes `WasmResizeAnchor` and is called in exactly one place (`editor-state.svelte.ts:handleResize`), so it moves to `CanvasFactory.resizeWithAnchor`.

This means `WasmPixelCanvas` satisfies `PixelCanvas` structurally with zero wrapping. `get_pixel` returns `WasmColor`, which satisfies `Color` (`{r,g,b,a}`) structurally.

### Reuse existing `Color` instead of new `PixelColor`

The existing `Color` interface in `color.ts` is `{r,g,b,a}` — identical to what a new `PixelColor` would be. `WasmColor` satisfies `Color` structurally. No new type needed.

### Module-level singletons, not constructor injection

`wasm-backend.ts` exports factory/ops objects as module-level singletons. Consumers import them directly. This matches the existing codebase pattern (e.g., `import { pencilTool } from './tools/pencil-tool'`). Converting to constructor injection is a separate follow-up if needed for testability.

### DrawingOps captures canvas via getter closure — no canvas parameter

`DrawingOps.applyTool(x, y, tool, color)` and `floodFill(x, y, color)` have no `canvas` parameter. Instead, `createDrawingOps(getCanvas: () => WasmPixelCanvas)` captures the canvas getter in a closure. This avoids `as` type assertions: inside `wasm-backend.ts`, the getter returns `WasmPixelCanvas` directly, so WASM free functions receive the correct type without casting. Consumers never see `WasmPixelCanvas`.

### `CanvasFactory.resizeWithAnchor` reconstructs from pixels

`resizeWithAnchor(canvas: PixelCanvas, w, h, anchor)` internally calls `WasmPixelCanvas.from_pixels(canvas.width, canvas.height, canvas.pixels())` to create a proper `WasmPixelCanvas`, then calls the WASM `resize_with_anchor`. One extra pixel copy per resize — negligible for a rare user action on max 256x256 canvases.

### `canvasReplaced` effect uses `PixelCanvas`

`RunnerEffect.canvasReplaced` carries `PixelCanvas` (not `WasmPixelCanvas`). The tool-runner uses `canvasFactory.fromPixels` for undo/redo dimension changes.

### Tool factories receive DrawingOps

Tools change from module-level singletons to factory functions: `pencilTool` → `createPencilTool(ops)`, `eraserTool` → `createEraserTool(ops)`. `createShapeTool` keeps `generatePixels` as a separate parameter — the tool-runner extracts it from `DrawingOps` (`ops.interpolatePixels`, `ops.rectangleOutline`, `ops.ellipseOutline`).

### No HistoryFactory interface

Only one consumer (`tool-runner`). `wasm-backend.ts` exports a simple `createHistoryManager(): HistoryManager` function. The `HistoryManager` interface itself is defined separately.

### Factory vs Ops separation

"Factory" names are reserved for interfaces that create instances. Pure utility functions and constants use "Ops" (for `ViewportOps`) or "Constraints" (for `CanvasConstraints`). This prevents the misleading impression that every call creates an instance.

### File layout — flat in `canvas/`

New files go in `src/lib/canvas/` root, matching existing patterns:

- `pixel-canvas.ts` — PixelCanvas, Snapshot interfaces
- `viewport.ts` — Viewport interface
- `history.ts` — HistoryManager interface
- `drawing-ops.ts` — DrawingOps, DrawingToolType
- `canvas-factory.ts` — CanvasFactory interface
- `canvas-constraints.ts` — CanvasConstraints interface
- `viewport-factory.ts` — ViewportFactory interface
- `viewport-ops.ts` — ViewportOps interface
- `wasm-backend.ts` — all WASM imports, factory/ops implementations, DrawingOps adapter
- `wasm-sync.test.ts` — compile-time structural compatibility guard

### `view-types.ts` and `viewport.ts` are separate files

`view-types.ts` holds consumer types (ViewportState, ViewportData, serialization helpers). `viewport.ts` holds the implementer contract (Viewport interface). Different roles: one for consumers, one for implementers.

### snake_case for instance methods, camelCase for facade-owned interfaces

Instance methods on PixelCanvas, Viewport, HistoryManager keep snake_case to match WASM-generated signatures (minimizes call-site changes). Factory methods, Ops methods, Constraints methods, and DrawingOps use camelCase (new interfaces, not WASM pass-through).

## Commits

### Commit 1: Add facade interface files (no consumer changes)

Create the 8 interface files and `wasm-backend.ts`. All new files, no existing code modified. Existing code continues to import directly from WASM.

- `pixel-canvas.ts`: `PixelCanvas` and `Snapshot` interfaces
- `viewport.ts`: `Viewport` interface
- `history.ts`: `HistoryManager` interface
- `drawing-ops.ts`: `DrawingOps` interface, `DrawingToolType` string literal union
- `canvas-factory.ts`: `CanvasFactory` interface
- `canvas-constraints.ts`: `CanvasConstraints` interface
- `viewport-factory.ts`: `ViewportFactory` interface
- `viewport-ops.ts`: `ViewportOps` interface
- `wasm-backend.ts`: WASM adapter implementing all factories/ops + `createDrawingOps` + `createHistoryManager`
- `wasm-sync.test.ts`: compile-time type assertions verifying `WasmViewport` satisfies `Viewport`, `WasmHistoryManager` satisfies `HistoryManager`, `WasmPixelCanvas` satisfies `PixelCanvas`

### Commit 2: Migrate viewport consumers

Replace `WasmViewport` with `Viewport` interface, `ViewportFactory` (creation), and `ViewportOps` (zoom arithmetic) across all viewport consumers:

- `view-types.ts`: `ViewportState.viewport` type changes from `WasmViewport` to `Viewport`. `restoreViewportState` uses `viewportFactory.create()` instead of `new WasmViewport()`. WASM import removed.
- `canvas-interaction.svelte.ts`: `CanvasInteractionOptions.getViewport` returns `Viewport`. `InteractionMode.pinching.initialViewport` typed as `Viewport`. `CanvasInteractionCallbacks.onViewportChange` takes `Viewport`. `WasmViewport.clamp_zoom()` → `viewportOps.clampZoom()`. WASM import removed.
- `PixelCanvasView.svelte`: `Props.pixelCanvas` typed as `PixelCanvas`. `Props.onViewportChange` takes `Viewport`. `WasmViewport.compute_pinch_zoom` / `next_zoom_level` / `prev_zoom_level` → `viewportOps` methods. WASM import removed.
- `editor-state.svelte.ts` (viewport part only): `handleViewportChange` parameter typed as `Viewport`. `handleZoomIn/Out/Reset` use `viewportOps.nextZoomLevel` / `prevZoomLevel`. Constructor uses `viewportFactory.forCanvas()`. `WasmViewport` import removed (but `WasmPixelCanvas` and `WasmResizeAnchor` imports remain — handled in commit 4).

### Commit 3: Migrate tool system

Replace WASM imports across the entire tool chain. This is an atomic change — `ToolContext` type change propagates to all tools and tool-runner simultaneously.

- `draw-tool.ts`: `ToolContext.canvas` typed as `PixelCanvas`, `ToolContext.drawColor` typed as `Color`. WASM import removed.
- `pencil-tool.ts`: Convert from module-level singletons to factory functions `createPencilTool(ops)` / `createEraserTool(ops)`. `createFreehandTool` takes `DrawingOps` + `DrawingToolType`. Uses `ops.applyTool()` and `ops.interpolatePixels()`. WASM import removed.
- `shape-tool.ts`: `createShapeTool(ops, tool, generatePixels, constrainFn)` — takes `DrawingOps` + `DrawingToolType` + pixel generator function. Uses `ops.applyTool()`. WASM import removed.
- `floodfill-tool.ts`: Convert to factory function `createFloodfillTool(ops)`. Uses `ops.floodFill()`. WASM import removed.
- `eyedropper-tool.ts`: No change needed — already uses only `ctx.canvas.get_pixel()` which is on `PixelCanvas`. No WASM import exists.
- `move-tool.ts`: No change needed — already uses only `ctx.canvas.restore_pixels()` which is on `PixelCanvas`. No WASM import exists.
- `tool-runner.svelte.ts`: Import `createDrawingOps`, `canvasFactory`, `createHistoryManager` from `wasm-backend`. Create `DrawingOps` via `createDrawingOps(() => host.pixelCanvas)`. Tool registry calls factory functions. `$derived` WasmColor instances removed (DrawingOps handles Color→WasmColor conversion internally). `buildContext` returns `drawColor: Color` instead of `WasmColor`. `applySnapshot` uses `canvasFactory.fromPixels()`. `RunnerEffect.canvasReplaced.canvas` typed as `PixelCanvas`. All WASM imports removed.

### Commit 4: Migrate EditorState and Workspace

- `editor-state.svelte.ts` (canvas part): `pixelCanvas` field typed as `PixelCanvas`. Constructor uses `canvasFactory.create()`. `handleResize` uses `canvasFactory.resizeWithAnchor()` — `RESIZE_ANCHOR_MAP` and `WasmResizeAnchor` import eliminated. `EditorOptions.pixelCanvas` typed as `PixelCanvas`. `ToolRunnerHost.pixelCanvas` typed as `PixelCanvas`. All remaining WASM imports removed.
- `workspace.svelte.ts`: `WasmPixelCanvas.from_pixels()` → `canvasFactory.fromPixels()`. WASM import removed.

### Commit 5: Migrate UI components

All 4 UI components use only `WasmPixelCanvas` static methods (presets, min/max dimension, isValidDimension). Switch to `canvasConstraints`:

- `ui-editor/CanvasSizeControl.svelte`: `WasmPixelCanvas.presets()` → `canvasConstraints.presets()`, `WasmPixelCanvas.min_dimension()` → `canvasConstraints.minDimension`, etc.
- `ui-editor/TopControlsRight.svelte`: Same pattern.
- `ui-pebble/TopControlsRight.svelte`: Same pattern.
- `ui-pixel/CanvasSettings.svelte`: Same pattern.

After this commit, `$wasm/dotorixel_wasm` appears in exactly 1 production file (`wasm-backend.ts`) plus `wasm/setup.ts` (initialization) and `wasm/init.ts` (lazy loader).

## Testing Decisions

### What makes a good test for this refactor

Each commit should leave all existing tests passing. The facade introduces no behavioral changes — only import paths and type annotations change. The compile-time sync guard (`wasm-sync.test.ts`) is the primary safety net, catching structural drift between WASM classes and facade interfaces.

### New tests

- **`wasm-sync.test.ts`**: Type-level assertions that `WasmPixelCanvas` satisfies `PixelCanvas`, `WasmViewport` satisfies `Viewport`, `WasmHistoryManager` satisfies `HistoryManager`. This file compiles only if structural compatibility holds.
- **`wasm-backend.test.ts`**: Runtime verification of the adapter layer. Tests `createDrawingOps` (tool routing, Color→WasmColor conversion), `canvasFactory` (create, fromPixels, withColor, resizeWithAnchor with anchor mapping), `canvasConstraints` (presets, dimension validation), `viewportFactory` (create, forCanvas), `viewportOps` (zoom arithmetic delegation), `createHistoryManager`. These tests use WASM setup since they verify the adapter correctness.

### Existing tests — no changes in this refactor

All existing test files continue to import WASM directly and run with WASM setup. Consumer test migration to test doubles (MockPixelCanvas, etc.) is a follow-up tracked in todo.md.

### Prior art

`renderer.ts` and `export.ts` already use structural interfaces (`RenderableCanvas`, `PngEncodable`) to decouple from WASM. The facade formalizes this existing pattern.

## Out of Scope

### Consumer test migration to facade test doubles

`tool-runner.svelte.test.ts`, `editor-state.svelte.test.ts`, `canvas-interaction.svelte.test.ts`, `session-persistence.test.ts`, and `session.test.ts` continue to import WASM directly. Migrating them to use `MockPixelCanvas`, `createMockViewport()`, `MockHistoryManager`, and `mockDrawingOps` is a separate follow-up. This is required to achieve the full goal of "testing core logic without WASM" but is not part of this refactor.

### Story file migration

`PixelCanvasView.stories.svelte` uses `WasmPixelCanvas`, `WasmColor`, and `WasmViewport` directly for data setup. Migrating to facade factories is a separate follow-up.

### Both follow-up items are tracked in `tasks/todo.md` under Milestone 2 → Architecture follow-up.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/pixel-canvas.ts` | PixelCanvas, Snapshot interfaces |
| `src/lib/canvas/viewport.ts` | Viewport interface |
| `src/lib/canvas/history.ts` | HistoryManager interface |
| `src/lib/canvas/drawing-ops.ts` | DrawingOps, DrawingToolType |
| `src/lib/canvas/canvas-factory.ts` | CanvasFactory interface |
| `src/lib/canvas/canvas-constraints.ts` | CanvasConstraints interface |
| `src/lib/canvas/viewport-factory.ts` | ViewportFactory interface |
| `src/lib/canvas/viewport-ops.ts` | ViewportOps interface |
| `src/lib/canvas/wasm-backend.ts` | WASM adapter — sole production WASM import |
| `src/lib/canvas/wasm-sync.test.ts` | Compile-time structural compatibility guard |

### Key Decisions

- Factory/Ops split: "Factory" reserved for instance creation, "Ops"/"Constraints" for pure functions and constants — avoids misleading naming
- `instanceof` type guard in `resolveWasmCanvas` instead of `as` cast — runtime-verified type narrowing within the adapter
- `ToolRunnerHost` and `RunnerEffect` migrated together with EditorState (not in the tool system commit) due to type boundary dependency
- Session test files received minimal `wasmCanvas()` helper to handle `set_pixel` calls after `pixelCanvas` type changed to `PixelCanvas`

### Notes

- `$wasm/dotorixel_wasm` now appears in exactly 1 production file (`wasm-backend.ts`) + `wasm/setup.ts` (initialization) + story/test files
- `PixelCanvasView.stories.svelte` still imports WASM directly — tracked as follow-up in todo.md
