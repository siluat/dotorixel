---
title: Consolidate viewport module — merge 4 thin files into one deep module
status: open
created: 2026-04-08
---

## Problem

The viewport domain is spread across 4 thin files totaling 114 LOC:

- `viewport.ts` (34 LOC) — `Viewport` interface
- `viewport-ops.ts` (11 LOC) — `ViewportOps` interface (zoom math)
- `viewport-factory.ts` (7 LOC) — `ViewportFactory` interface
- `view-types.ts` (62 LOC) — mixed types (`ViewportState`, `ViewportData`, `CanvasCoords`, `ResizeAnchor`) + serialization functions

This creates three problems:

1. **Circular dependency**: `view-types.ts` runtime-imports `viewportFactory` from `wasm-backend.ts`, while `wasm-backend.ts` type-imports `ResizeAnchor` from `view-types.ts`. The runtime import is the problem — it couples the type definition layer to the WASM adapter layer.

2. **Non-viewport types mixed in**: `CanvasCoords` and `ResizeAnchor` live in `view-types.ts` despite being used by tools (`draw-tool.ts`, `constrain.ts`), canvas operations (`canvas-factory.ts`), and UI components that have no viewport awareness. Consumers import a "viewport" module just to get spatial primitives.

3. **Over-split shallow modules**: Understanding the viewport system requires bouncing between 4 files. The interface-to-implementation ratio is close to 1:1 for each file individually — a signal that they should be one module.

## Proposed Interface

### New file: `canvas-types.ts` (leaf, zero imports)

```typescript
export interface CanvasCoords {
  readonly x: number;
  readonly y: number;
}

export type ResizeAnchor =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';
```

### Consolidated file: `viewport.ts` (~100 LOC)

Merges all viewport interfaces, types, and serialization into one module. Single import dependency: `canvas-types.ts`.

```typescript
import type { CanvasCoords } from './canvas-types';

// Value types
export interface ViewportSize { readonly width: number; readonly height: number; }
export interface ViewportState { readonly viewport: Viewport; readonly showGrid: boolean; readonly gridColor: string; }
export interface ViewportData { readonly pixelSize: number; readonly zoom: number; readonly panX: number; readonly panY: number; readonly showGrid: boolean; readonly gridColor: string; }

// Core interface (structurally satisfied by WasmViewport)
export interface Viewport {
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

// Zoom math (pure functions, no Viewport instances)
export interface ViewportOps { /* clampZoom, computePinchZoom, nextZoomLevel, prevZoomLevel, defaultPixelSize, zoomLevels, minZoom, maxZoom */ }

// Creation
export interface ViewportFactory {
  create(pixelSize: number, zoom: number, panX: number, panY: number): Viewport;
  forCanvas(canvasWidth: number, canvasHeight: number): Viewport;
}

// Serialization (pure — no WASM dependency)
export function extractViewportData(state: ViewportState): ViewportData;
export function restoreViewportState(data: ViewportData, factory: ViewportFactory): ViewportState;
```

### Circular dependency fix

`restoreViewportState` takes a `ViewportFactory` parameter instead of importing `viewportFactory` from `wasm-backend`. The caller (`workspace.svelte.ts`) passes the factory explicitly:

```typescript
// workspace.svelte.ts
import { restoreViewportState } from './viewport';
import { viewportFactory } from './wasm-backend';

viewportState: restoreViewportState(tab.viewport, viewportFactory)
```

### Caller usage (most common path — editor-state)

```typescript
// Before: 3 imports from viewport cluster
import type { Viewport } from './viewport';
import { canvasFactory, viewportFactory, viewportOps } from './wasm-backend';
import { extractViewportData, type CanvasCoords, type ResizeAnchor, type ViewportSize, type ViewportState } from './view-types';

// After: 2 imports, cleanly split by domain
import { extractViewportData, type Viewport, type ViewportSize, type ViewportState } from './viewport';
import type { CanvasCoords, ResizeAnchor } from './canvas-types';
import { canvasFactory, viewportFactory, viewportOps } from './wasm-backend';
```

## Commits

### Commit 1 — Extract `canvas-types.ts` with re-export shim

Create `canvas-types.ts` with `CanvasCoords` and `ResizeAnchor`. In `view-types.ts`, replace the original definitions with re-exports from `canvas-types.ts`. This keeps all existing consumers working without any import path changes.

Update `viewport.ts` to import `CanvasCoords` from `canvas-types` instead of `view-types` (it still imports `ViewportSize` from `view-types`).

All tests pass — zero consumer changes.

### Commit 2 — Migrate CanvasCoords consumers to canvas-types

Update every file that imports `CanvasCoords` from `view-types` to import from `canvas-types` instead. This is a mechanical change across ~12 files:

- canvas/: `draw-tool.ts`, `constrain.ts`, `tool-runner.svelte.ts`, `canvas-interaction.svelte.ts`, `editor-state.svelte.ts`, `PixelCanvasView.svelte`
- canvas/tools/: `pencil-tool.ts`, `shape-tool.ts`, `move-tool.ts`, `eyedropper-tool.ts`, `floodfill-tool.ts`
- tests: `editor-state.svelte.test.ts`

### Commit 3 — Migrate ResizeAnchor consumers to canvas-types

Update every file that imports `ResizeAnchor` from `view-types` to import from `canvas-types` instead. ~6 files:

- canvas/: `canvas-factory.ts`, `wasm-backend.ts`, `editor-state.svelte.ts`
- ui-editor/: `AnchorSelector.svelte`, `CanvasSizeControl.svelte`, `RightPanel.svelte`, `SettingsContent.svelte`

After this commit, remove the re-exports of `CanvasCoords` and `ResizeAnchor` from `view-types.ts` — no one imports them from there anymore.

### Commit 4 — Merge ViewportOps and ViewportFactory interfaces into viewport.ts

Move `ViewportOps` interface from `viewport-ops.ts` and `ViewportFactory` interface from `viewport-factory.ts` into the consolidated `viewport.ts`.

Delete `viewport-ops.ts` and `viewport-factory.ts`. Update `wasm-backend.ts` to import `ViewportFactory` and `ViewportOps` from `viewport` instead of the deleted files.

### Commit 5 — Move viewport value types and extractViewportData to viewport.ts

Move `ViewportSize`, `ViewportState`, `ViewportData`, and `extractViewportData()` from `view-types.ts` into `viewport.ts`. Update all consumer imports:

- canvas/: `editor-state.svelte.ts`, `renderer.ts`, `PixelCanvasView.svelte`, `PixelCanvasView.stories.svelte`
- session/: `workspace-init-types.ts`, `session-persistence.ts`, `session-storage-types.ts`

After this commit, `viewport.ts` no longer imports anything from `view-types.ts`. The only thing left in `view-types.ts` is `restoreViewportState` (still importing from `wasm-backend`).

### Commit 6 — Break circular dependency: move restoreViewportState with factory injection

Move `restoreViewportState` from `view-types.ts` into `viewport.ts`, changing its signature to accept a `ViewportFactory` parameter instead of importing `viewportFactory` from `wasm-backend`.

Update callers:

- `workspace.svelte.ts`: pass `viewportFactory` as second argument, update import path
- Rename `view-types.test.ts` to `viewport.test.ts`, update imports and pass `viewportFactory` to `restoreViewportState`

Delete the now-empty `view-types.ts`. This commit eliminates the circular dependency.

### Commit 7 — Add ViewportOps zoom math boundary tests

Add TS-level tests for `ViewportOps` operations in `viewport.test.ts`:

- `clampZoom`: values at and beyond min/max boundaries
- `nextZoomLevel` / `prevZoomLevel`: step progression, boundary behavior at min/max
- `computePinchZoom`: positive and negative delta application
- `zoomLevels`: ascending order, contains min/max
- `minZoom` / `maxZoom`: consistent with `clampZoom` boundaries

These tests import `viewportOps` from `wasm-backend` — same pattern as existing WASM tests (`wasm-viewport.test.ts`).

## Decision Document

- **Two files, not one**: `CanvasCoords` and `ResizeAnchor` are not viewport concepts — they are canvas-domain spatial primitives used by tools, constraints, and UI components. Extracting them to `canvas-types.ts` (a zero-dependency leaf) prevents the viewport module from becoming a dumping ground.
- **ViewportFactory interface retained**: Considered eliminating it (Design A from the exploration phase) but kept it because (a) `wasm-backend.ts` already uses it as a type annotation, (b) it enables mock-based testing of `restoreViewportState`, and (c) a 5-line interface doesn't justify losing type safety.
- **Factory injection over hard import**: `restoreViewportState` takes a `ViewportFactory` parameter instead of importing from `wasm-backend`. This is the structural fix for the circular dependency — the function becomes pure and backend-agnostic.
- **Dependency direction: viewport ← wasm-backend ← consumers**: Matches the established codebase pattern where domain interfaces (`pixel-canvas.ts`, `drawing-ops.ts`, `history.ts`) sit below `wasm-backend.ts`. Validated by substitution test: replacing WASM with a pure JS backend requires zero changes to `viewport.ts`.
- **In-process dependency category**: Pure computation, no I/O. The consolidated module contains only interfaces and pure serialization functions. All WASM implementation stays in `wasm-backend.ts`.
- **Re-export shim strategy**: Commit 1 introduces re-exports in `view-types.ts` so the extraction is backward-compatible. Later commits migrate consumers, then remove the shims. This keeps every intermediate commit green.

## Testing Decisions

### What makes a good test here

Tests should verify observable behavior at the module boundary — "given this input, does the function return the expected output?" — not internal structure. A test should survive renaming a file or moving an interface without needing changes.

### Modules tested

- **Serialization round-trip** (existing, migrated): `extractViewportData ↔ restoreViewportState` round-trip with a real WASM viewport. Existing 3 tests in `view-types.test.ts` are renamed to `viewport.test.ts` and updated to pass factory.
- **Mock factory round-trip** (new): `restoreViewportState` called with a plain object factory (no WASM) to verify the function is backend-agnostic.
- **ViewportOps zoom math** (new): Boundary tests for `clampZoom`, `nextZoomLevel`, `prevZoomLevel`, `computePinchZoom`, `zoomLevels`, `minZoom`, `maxZoom`. Currently 0 TS-level tests for these — Rust coverage exists but TypeScript boundary verification is missing.

### Prior art

- `wasm-viewport.test.ts`: Tests WASM bindings for Viewport instance methods (screen_to_canvas, zoom_at_point, etc.). Uses `WasmViewport` directly.
- `wasm-sync.test.ts`: Structural type compatibility checks between WASM and facade interfaces using `expectTypeOf`.
- The new ViewportOps tests follow the same pattern as `wasm-viewport.test.ts` — import the implementation from `wasm-backend`, call it, assert on values.

## Out of Scope

- **Other architectural improvements**: The EditorState orchestrator triad (#1), tool addition pipeline (#2), and session persistence (#3) candidates are separate future work.
- **Viewport implementation changes**: No changes to `wasm-backend.ts` exports or Rust/WASM code beyond import path updates.
- **New viewport features**: No new zoom levels, animated transitions, or multi-viewport support.
- **UI component testing**: UI components that consume viewport types (PixelCanvasView, AnchorSelector, etc.) receive import path changes only — no new component tests.
- **wasm-sync.test.ts updates**: This file imports `Viewport` from `./viewport`, which is unchanged — no migration needed.
