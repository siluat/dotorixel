---
title: Viewport data-only — eliminate Viewport interface from public API
status: done
created: 2026-04-08
---

## Problem

After issues #023 (ViewportData unification) and #026 (viewport module consolidation), the viewport system is well-organized but still carries two parallel representations of the same camera state:

- **`Viewport`** — an interface with snake_case fields (`pixel_size`, `pan_x`, `pan_y`) and methods (`zoom_at_point`, `pan`, `screen_to_canvas`). Structurally typed against WasmViewport.
- **`ViewportData`** — a plain object with camelCase fields (`pixelSize`, `panX`, `panY`). Used for rendering, persistence, and Svelte reactivity.

This duality creates three friction points:

1. **PixelCanvasView receives both forms**: `viewportState: ViewportState` (for interaction methods) and `renderViewport: ViewportData` (for rendering). Same camera values passed twice in different shapes.

2. **Continuous conversion overhead**: `extractViewportData()` maps snake_case fields to camelCase every time viewport state changes. `EditorState` stores `ViewportState` as `$state` and derives `renderViewport` via `$derived(extractViewportData(...))`.

3. **ViewportState is a thin wrapper**: `{ viewport: Viewport, showGrid: boolean, gridColor: string }` — groups 3 fields with no logic of its own.

## Proposed Interface

Make `ViewportData` the single viewport representation everywhere. Push WASM methods into `ViewportOps` as functions that accept `ViewportData`.

### Core types (2, down from 6)

```typescript
/** Plain-object camera + display state. The single viewport representation.
 *  Serializable, Svelte-friendly, renderer-compatible. */
export interface ViewportData {
  readonly pixelSize: number;
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
  readonly showGrid: boolean;
  readonly gridColor: string;
}

/** All viewport operations — camera transforms + zoom math.
 *  Injected at the boundary, never stored as state. */
export interface ViewportOps {
  // Camera transforms (each returns a new ViewportData)
  screenToCanvas(vd: ViewportData, screenX: number, screenY: number): CanvasCoords;
  zoomAtPoint(vd: ViewportData, screenX: number, screenY: number, newZoom: number): ViewportData;
  pan(vd: ViewportData, deltaX: number, deltaY: number): ViewportData;
  clampPan(vd: ViewportData, canvasW: number, canvasH: number, vpW: number, vpH: number): ViewportData;
  fitToViewport(vd: ViewportData, canvasW: number, canvasH: number, vpW: number, vpH: number, maxZoom: number): ViewportData;
  effectivePixelSize(vd: ViewportData): number;
  displaySize(vd: ViewportData, canvasW: number, canvasH: number): ViewportSize;
  forCanvas(canvasW: number, canvasH: number): ViewportData;

  // Zoom math (existing, unchanged)
  clampZoom(zoom: number): number;
  computePinchZoom(currentZoom: number, deltaY: number): number;
  nextZoomLevel(currentZoom: number): number;
  prevZoomLevel(currentZoom: number): number;
  defaultPixelSize(canvasW: number, canvasH: number): number;
  zoomLevels(): number[];
  readonly minZoom: number;
  readonly maxZoom: number;
}
```

### What gets eliminated

| Removed | Absorbed Into |
|---------|---------------|
| `Viewport` (interface) | Internal to WASM adapter — `ViewportOps` methods wrap it |
| `ViewportState` | `ViewportData` directly (grid fields already present) |
| `ViewportFactory` | `ViewportOps.forCanvas()` and internal WASM adapter |
| `extractViewportData()` | Gone — no conversion needed |
| `restoreViewportState()` | Gone — `ViewportData` is already the stored form |

### Caller usage: EditorState

```typescript
// Before
viewportState = $state<ViewportState>(null!);
readonly renderViewport = $derived(extractViewportData(this.viewportState));

handleZoomIn = (): void => {
  const newZoom = viewportOps.nextZoomLevel(this.viewportState.viewport.zoom);
  const zoomed = this.viewportState.viewport.zoom_at_point(centerX, centerY, newZoom);
  this.handleViewportChange(zoomed);
};

// After
viewport = $state<ViewportData>(null!);

handleZoomIn = (): void => {
  const newZoom = this.#viewportOps.nextZoomLevel(this.viewport.zoom);
  this.viewport = this.#viewportOps.clampPan(
    this.#viewportOps.zoomAtPoint(this.viewport, centerX, centerY, newZoom),
    ...
  );
};
```

### Caller usage: PixelCanvasView

```typescript
// Before — two viewport props
interface Props {
  viewportState: ViewportState;
  renderViewport: { pixelSize; zoom; panX; panY; showGrid; gridColor };
}

// After — one prop (viewportOps imported directly from wasm-backend)
interface Props {
  viewport: ViewportData;
}

// Interaction
screenToCanvas: (x, y) => viewportOps.screenToCanvas(viewport, x, y)

// Rendering — viewport IS the render data
renderPixelCanvas(ctx, pixelCanvas, viewport, viewportSize);
```

### Caller usage: session persistence

```typescript
// Before
viewports[docId] = extractViewportData(editor.viewportState);

// After — zero conversion
viewports[docId] = editor.viewport;
```

### What complexity it hides

The WASM adapter implements `ViewportOps` by internally constructing ephemeral `WasmViewport` instances per call:

```typescript
export const viewportOps: ViewportOps = {
  zoomAtPoint(vd, sx, sy, newZoom) {
    const wasm = new WasmViewport(vd.pixelSize, vd.zoom, vd.panX, vd.panY);
    const result = wasm.zoom_at_point(sx, sy, newZoom);
    return { ...vd, zoom: result.zoom, panX: result.pan_x, panY: result.pan_y };
  },
  screenToCanvas(vd, sx, sy) {
    const wasm = new WasmViewport(vd.pixelSize, vd.zoom, vd.panX, vd.panY);
    const coords = wasm.screen_to_canvas(sx, sy);
    return { x: coords.x, y: coords.y };
  },
  // ...
};
```

The caller never sees `WasmViewport`, snake_case fields, or the create-use-discard pattern. The naming gap is fully absorbed by the adapter.

## Commits

### Commit 1: Expand ViewportOps with camera transform methods

Purely additive — no existing code changes. All existing tests pass.

In the `ViewportOps` interface, add camera transform methods alongside the existing zoom math methods:

- `screenToCanvas(vd, screenX, screenY): CanvasCoords`
- `zoomAtPoint(vd, screenX, screenY, newZoom): ViewportData`
- `pan(vd, deltaX, deltaY): ViewportData`
- `clampPan(vd, canvasW, canvasH, vpW, vpH): ViewportData`
- `fitToViewport(vd, canvasW, canvasH, vpW, vpH, maxZoom): ViewportData`
- `effectivePixelSize(vd): number`
- `displaySize(vd, canvasW, canvasH): ViewportSize`
- `forCanvas(canvasW, canvasH): ViewportData` — returns ViewportData with default grid settings (`showGrid: true`, `gridColor: '#cccccc'`)

In the WASM adapter, implement each method by constructing an ephemeral `WasmViewport`, calling the corresponding WASM method, and returning a new `ViewportData` (using `{ ...vd, field: result.field }` to preserve grid settings). The `forCanvas` method uses `WasmViewport.for_canvas()` internally and adds default grid values.

Add boundary tests for all new methods: verify return values, field preservation, and edge cases (e.g., clampPan at extreme offsets, screenToCanvas with pan offsets).

### Commit 2: Migrate codebase from Viewport/ViewportState to ViewportData

Atomic coordinated change. The callback chain `canvas-interaction → PixelCanvasView → EditorState` requires all participants to agree on the `ViewportData` type simultaneously.

**EditorState** (`editor-state.svelte.ts`):

- Replace `viewportState = $state<ViewportState>` with `viewport = $state<ViewportData>`
- Remove `renderViewport` derived (consumers use `viewport` directly)
- Change `handleViewportChange` signature from `(newViewport: Viewport)` to `(newViewport: ViewportData)`, replace `newViewport.clamp_pan(...)` with `viewportOps.clampPan(newViewport, ...)`
- Update all zoom/pan/fit/grid methods to use `viewportOps` functions instead of `Viewport` methods
- Update `EditorOptions`: `viewportState?: ViewportState` → `viewport?: ViewportData`
- Update constructor: use `viewportOps.forCanvas()` instead of `viewportFactory.forCanvas()` + manual ViewportState wrapping

**canvas-interaction** (`canvas-interaction.svelte.ts`):

- Change `CanvasInteractionOptions.getViewport` return type: `() => Viewport` → `() => ViewportData`
- Change `CanvasInteractionCallbacks.onViewportChange` parameter type: `(viewport: Viewport)` → `(viewport: ViewportData)`
- Change `InteractionMode` pinching state: `initialViewport: Viewport` → `initialViewport: ViewportData`
- Update pinch logic: replace `interaction.initialViewport.zoom_at_point(...)` and `.pan(...)` with `viewportOps.zoomAtPoint(...)` and `viewportOps.pan(...)` (already imports `viewportOps` from `wasm-backend`)

**PixelCanvasView** (`PixelCanvasView.svelte`):

- Remove `viewportState` and `renderViewport` props. Add single `viewport: ViewportData` prop
- Update `createCanvasInteraction` options: `screenToCanvas` uses `viewportOps.screenToCanvas(viewport, x, y)`, `getViewport` returns `viewport`
- Update wheel handler: replace `vp.pan(...)` with `viewportOps.pan(vp, ...)`, replace `vp.zoom_at_point(...)` with `viewportOps.zoomAtPoint(vp, ...)`
- Pass `viewport` directly to `renderPixelCanvas()` (it already accepts `ViewportData`)

**PixelCanvasView stories** (`PixelCanvasView.stories.svelte`):

- Replace `makeViewportState` + `makeRenderViewport` helpers with single `viewportOps.forCanvas()` call
- Story data objects return `{ pixelCanvas, viewport }` instead of `{ pixelCanvas, viewportState, renderViewport }`

**Workspace restore** (`workspace.svelte.ts`):

- Replace `restoreViewportState(tab.viewport, viewportFactory)` with direct `tab.viewport` (ViewportData is already the stored form)

**Session persistence** (`session-persistence.ts`):

- Replace `extractViewportData(editor.viewportState)` with `editor.viewport`

**Barrel export** (`index.ts`):

- Replace `type ViewportState` export with `type ViewportData`

**Route pages** (`editor/+page.svelte`, `pixel/+page.svelte`, `pebble/+page.svelte`):

- Update PixelCanvasView prop passing: remove `viewportState` and `renderViewport`, add `viewport={editor.viewport}`
- Update `showGrid` access: `editor.viewportState.showGrid` → `editor.viewport.showGrid`
- pebble route: import `viewportOps` from `wasm-backend`, replace `editor.viewportState.viewport.pan(dx, dy)` with `viewportOps.pan(editor.viewport, dx, dy)`, assign directly to `editor.viewport`

**Test files** (migrated together to keep codebase green):

- `editor-state.svelte.test.ts`: Replace `viewportState` references with `viewport`, replace `viewportFactory.forCanvas()` with `viewportOps.forCanvas()` in setup, update viewport field access patterns
- `canvas-interaction.svelte.test.ts`: Update `setup()` to use `viewportOps.forCanvas()` and `viewportOps.screenToCanvas()` instead of `viewportFactory.forCanvas()` and `viewport.screen_to_canvas()`

### Commit 3: Replace wasm-viewport.test.ts with ViewportOps boundary tests

Delete `wasm-viewport.test.ts` — it tests `WasmViewport` directly, which is now internal to the WASM adapter.

Add camera transform tests to `viewport.test.ts`, testing through the `ViewportOps` public interface:

- `screenToCanvas`: coordinate mapping with default viewport, with pan offset, off-canvas positions
- `zoomAtPoint`: zoom changes at a point, pan adjustment
- `pan`: delta application, negative deltas
- `clampPan`: boundary enforcement at extreme offsets
- `fitToViewport`: auto-fit behavior for various canvas/viewport size combinations
- `effectivePixelSize`: calculation at various zoom levels
- `displaySize`: dimension calculation
- `forCanvas`: initial viewport creation, default grid values

Remove the `WasmViewport satisfies Viewport` structural compatibility test from `wasm-sync.test.ts` (the `Viewport` interface is no longer public).

### Commit 4: Remove dead types and cleanup

In `viewport.ts`:

- Remove `Viewport` interface
- Remove `ViewportState` interface
- Remove `ViewportFactory` interface
- Remove `extractViewportData()` function
- Remove `restoreViewportState()` function

In `wasm-backend.ts`:

- Remove `viewportFactory` export
- Update imports (remove `ViewportFactory` type import from viewport.ts)

In `viewport.test.ts`:

- Remove `extractViewportData`/`restoreViewportState` round-trip tests (3 tests)
- Remove mock factory test (1 test)

## Decision Document

### Dependency category

**In-process**: Pure computation, no I/O. `ViewportData` is a plain interface with zero dependencies. `ViewportOps` is implemented in the WASM adapter by wrapping `WasmViewport` internally. The `Viewport` interface and `ViewportFactory` become internal to the adapter.

### Dependency direction after change

```text
viewport.ts (ViewportData, ViewportOps, ViewportSize — interfaces only, zero imports)
  ├── wasm-backend.ts (implements ViewportOps using WasmViewport internally)
  ├── editor-state.svelte.ts (stores ViewportData, uses ViewportOps)
  ├── canvas-interaction.svelte.ts (uses ViewportOps via direct import)
  ├── PixelCanvasView.svelte (uses ViewportOps via direct import)
  ├── renderer.ts (receives ViewportData — unchanged)
  ├── session-persistence.ts (reads ViewportData — no conversion)
  └── session-storage-types.ts (import type ViewportData — unchanged)
```

### ViewportOps access pattern: direct import

`canvas-interaction.svelte.ts` and `PixelCanvasView.svelte` already import `viewportOps` from `wasm-backend` (for `clampZoom` and zoom level functions). The refactor extends usage to camera transform methods via the same direct import. No injection or prop-passing of ViewportOps is introduced.

Rationale: consistent with existing codebase pattern. `canvas-interaction.svelte.test.ts` already uses real WASM (not mocks) for viewport operations, so injection provides no practical testing benefit at this point.

### `forCanvas` includes grid defaults

`viewportOps.forCanvas(w, h)` returns a complete `ViewportData` with `showGrid: true` and `gridColor: '#cccccc'`. Callers override grid values via spread when needed.

Rationale: the default grid values (`true`, `#cccccc`) are identical across all current creation sites (EditorState constructor, stories, session DEFAULT_VIEWPORT). Centralizing the default eliminates duplication.

### Camera transform methods preserve grid settings

Every ViewportOps method that takes and returns ViewportData (zoomAtPoint, pan, clampPan, fitToViewport) preserves the input's `showGrid` and `gridColor` via spread (`{ ...vd, zoom: ..., panX: ..., panY: ... }`). This means grid settings flow through camera operations without explicit handling by callers.

### Ephemeral WASM construction is acceptable

Each ViewportOps camera method internally constructs a `WasmViewport`, calls the WASM method, and discards it. For chained calls (e.g., `zoomAtPoint` then `clampPan` in a pinch gesture), this means two WASM constructions instead of one. This is negligible: viewport operations happen on user gestures (not per-frame), and `WasmViewport` construction is a 4-field struct allocation.

### pebble route uses direct viewport assignment

`pebble/+page.svelte` applies an initial centering pan offset directly to `editor.viewport` (not via `handleViewportChange`). This preserves the existing pattern where the centering adjustment intentionally skips `clampPan`.

## Testing Decisions

### What makes a good test here

Tests should verify observable behavior through the public `ViewportOps` interface — "given this ViewportData input and these parameters, does the function return the expected ViewportData?" Tests should not depend on internal `WasmViewport` construction, snake_case property names, or the ephemeral create-use-discard pattern. A test should survive internal adapter changes without modification.

### New tests (commit 1 + commit 3)

**ViewportOps camera transforms** in `viewport.test.ts`:

- `screenToCanvas`: coordinate mapping at default viewport, with pan offset, off-canvas positions producing negative coordinates
- `zoomAtPoint`: verify zoom value changes, pan adjusts to keep point stable
- `pan`: delta application in both directions, negative deltas
- `clampPan`: extreme offsets get clamped, in-range offsets preserved
- `fitToViewport`: auto-fit for small canvas in large viewport, max_zoom constraint
- `effectivePixelSize`: `pixelSize * zoom` at various levels
- `displaySize`: correct dimensions for given canvas size
- `forCanvas`: returns valid ViewportData with positive pixelSize, zoom 1.0, pan 0/0, showGrid true, gridColor '#cccccc'

### Tests retained unchanged

- **viewport.test.ts ViewportOps zoom math**: `clampZoom`, `nextZoomLevel`, `prevZoomLevel`, `computePinchZoom`, `zoomLevels` — signatures identical before and after

### Tests migrated (commit 2)

- **editor-state.svelte.test.ts**: replace `viewportState` with `viewport` in setup and assertions. Replace `viewportFactory.forCanvas()` with `viewportOps.forCanvas()`. Mechanical find-and-replace; test logic unchanged.
- **canvas-interaction.svelte.test.ts**: update `setup()` viewport creation and `screenToCanvas` mock to use `viewportOps` functions. Test logic unchanged.

### Tests deleted (commit 3 + commit 4)

- **wasm-viewport.test.ts**: entire file deleted — replaced by ViewportOps boundary tests
- **wasm-sync.test.ts `WasmViewport satisfies Viewport`**: test case removed — `Viewport` interface no longer public
- **viewport.test.ts round-trip tests**: `extractViewportData`/`restoreViewportState` tests removed — functions eliminated
- **viewport.test.ts mock factory test**: `ViewportFactory` removed from public API

### Prior art

- Existing `viewport.test.ts` ViewportOps tests follow the same pattern: import `viewportOps` from `wasm-backend`, call methods, assert on values
- `wasm-viewport.test.ts` (being replaced) demonstrates the test coverage expected for camera operations

### Test environment

WASM must be available (existing `vitest.config.ts` setup handles this).

## Out of Scope

- **Rust/WASM code changes**: `WasmViewport` Rust implementation stays as-is. No `js_name` additions or API changes.
- **Renderer changes**: `renderer.ts` already accepts `ViewportData` — no modifications needed.
- **Session storage schema changes**: `session-storage-types.ts` and `workspace-init-types.ts` already use `ViewportData` — no modifications needed.
- **Bench route changes**: `bench/+page.svelte` already creates ViewportData-compatible plain objects directly — no modifications needed.
- **ViewportOps injection pattern**: ViewportOps continues to be imported directly from `wasm-backend`. Switching to dependency injection is a separate concern if needed later.
- **serde-wasm-bindgen adoption**: Deferred to Milestone 3 project file format (tracked in `tasks/todo.md`).
- **Other architectural improvements**: UI theme duplication (#1), route bootstrap consolidation (#2), session layer simplification (#4) are separate future work.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/viewport.ts` | Reduced from 140 to 68 lines — only ViewportData, ViewportOps, ViewportSize remain |
| `src/lib/canvas/wasm-backend.ts` | Added ViewportOps camera transform implementations; removed viewportFactory export |
| `src/lib/canvas/editor-state.svelte.ts` | `viewportState` → `viewport`, `renderViewport` derived removed |
| `src/lib/canvas/canvas-interaction.svelte.ts` | Interfaces and pinch/pan logic migrated to ViewportData |
| `src/lib/canvas/PixelCanvasView.svelte` | 2 viewport props → 1 (`viewport: ViewportData`) |
| `src/lib/canvas/PixelCanvasView.stories.svelte` | Simplified with `viewportOps.forCanvas()` |
| `src/lib/canvas/workspace.svelte.ts` | Removed restoreViewportState, ViewportData used directly |
| `src/lib/session/session-persistence.ts` | Removed extractViewportData, spread copy for serialization |
| `src/lib/canvas/viewport.test.ts` | 14 new camera transform tests, 4 old round-trip tests removed |
| `src/lib/wasm/wasm-viewport.test.ts` | Deleted — replaced by ViewportOps boundary tests |

### Key Decisions
- ViewportOps via direct import (not injection) — consistent with existing pattern
- `forCanvas()` includes grid defaults (`showGrid: true`, `gridColor: '#cccccc'`)
- wasm-viewport.test.ts replaced (not retained alongside) ViewportOps tests
- Session persistence uses `{ ...editor.viewport }` spread to avoid Svelte $state Proxy serialization issue

### Notes
- Completes the 3-step viewport deepening: #023 (type unification) → #026 (file consolidation) → #029 (interface elimination)
- Test count: 462 → 444 (net -18: +14 new, -12 wasm-viewport, -1 wasm-sync, -4 round-trip, -15 overlap with commit 1 additions absorbed)

