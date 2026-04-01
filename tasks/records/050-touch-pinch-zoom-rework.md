# 050 — Touch Pinch-Zoom and Two-Finger Pan (Rework)

## Plan

### Context

Refactoring (#82) extracted the canvas interaction state machine into `canvas-interaction.svelte.ts`. Now add multi-touch gestures (pinch-zoom, two-finger pan) to this module and fix the first-pixel bug where touch pointerdown paints a pixel before a pinch gesture is detected. Existing PR #81 (`feat/touch-pinch-zoom-pan`) is based on pre-refactoring code and will be closed; a new PR is created.

### Implementation Plan

#### 1. canvas-interaction.svelte.ts — API Extension

**Type changes:**

- `InteractionType`: add `'pinching'`
- `InteractionMode`: add pinching variant with `initialViewport`, `initialDistance`, `initialMidX`, `initialMidY`
- Drawing variant: add `pendingCoords: CanvasCoords | null`

**Method signature changes:**

- `pointerDown(id, x, y, pointerType, button)` — add id, pointerType
- `windowPointerMove(id, x, y, buttons)` — add id
- `pointerUp(id, x, y)` — add id, x, y

Change `WasmViewport` from `import type` to `import` — `WasmViewport.clamp_zoom()` static method needed.

**Internal additions:**

- `activePointers: Map<number, {x, y}>`
- `MIN_PINCH_DISTANCE = 10`
- Helpers: `pointerDistance()`, `pointerMidpoint()`, `getTwoPointers()`, `tryEnterPinching()`

**pointerDown changes:**

1. Add to activePointers
2. If 2+ pointers: cancel drawing (discard if pendingCoords, onDrawEnd if committed), tryEnterPinching, return
3. If not idle: return
4. Middle click / space: panning
5. Left click: touch → drawing with pendingCoords (defer), mouse → drawing immediate

**pointerMove changes:**

If drawing with pendingCoords: commit pending (onDrawStart + drawAt(pending)), then drawAt(current).

**windowPointerMove changes:**

Update activePointers. Deferred pinch entry. Pinch: drift-free zoom+pan from initialViewport. Panning: existing.

**pointerUp changes:**

Remove from activePointers. Pinching → idle. Drawing with pendingCoords → commit as tap (onDrawStart + drawAt + onDrawEnd). Drawing without → onDrawEnd.

**pointerLeave changes:**

Pinching → ignore. Drawing with pendingCoords → idle (discard). Drawing without → drawAt + onDrawEnd + idle.

**blur changes:**

Clear activePointers. Drawing without pendingCoords → onDrawEnd. Idle.

#### 2. PixelCanvasView.svelte — DOM Event Wiring

Pass `event.pointerId`, `event.pointerType`, coordinates to updated method signatures.

#### 3. Tests (canvas-interaction.svelte.test.ts)

Update existing tests for new signatures. Add pinching suite (7 tests) and touch deferral suite (5 tests).

#### 4. Close PR #81

After new PR is created.

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/canvas/canvas-interaction.svelte.ts` | Pinching state + multi-touch + pendingCoords |
| `src/lib/canvas/canvas-interaction.svelte.test.ts` | Signature updates + pinch/touch-deferral tests |
| `src/lib/canvas/PixelCanvasView.svelte` | Pass pointerId/pointerType/coords |

### Verification

1. `bun run check` — type check passes
2. `bun run test` — all tests pass
3. Manual: mouse drawing, middle-click pan, space+drag pan, trackpad pinch zoom, mouse wheel zoom, touch pinch-zoom, touch tap drawing, no first-pixel on pinch

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/canvas-interaction.svelte.ts` | Added pinching state, multi-touch pointer tracking, pendingCoords for touch deferral, drift-free zoom+pan calculation |
| `src/lib/canvas/canvas-interaction.svelte.test.ts` | Updated 19 existing tests for new signatures, added 8 pinching tests + 5 touch deferral tests + 2 edge case tests (34 total) |
| `src/lib/canvas/PixelCanvasView.svelte` | Pass pointerId, pointerType, coords to interaction module; add canvasEl guard on handlePointerUp |

### Key Decisions

- **Touch deferral via `pendingCoords`**: Touch pointerDown stores coords without calling onDrawStart/onDraw. Committed on first pointermove (draw) or pointerUp (tap). Discarded on 2nd pointer (pinch). No visual flash, no undo stack pollution.
- **Drift-free baseline zoom**: Each pinch frame recomputes from `initialViewport` snapshot rather than accumulating frame-to-frame deltas.
- **`canvasEl` guard on `handlePointerUp`**: Added for consistency with `handleWindowPointerMove`, even though the guard is unlikely to trigger in practice.

### Notes

- PR #81 (`feat/touch-pinch-zoom-pan`) should be closed after this PR merges — it was based on pre-refactoring code.
