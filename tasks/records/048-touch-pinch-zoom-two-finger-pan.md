# 048 — Touch Pinch-Zoom and Two-Finger Pan

## Plan

### Context

Resolve the inability to zoom/pan the canvas on touch devices. Currently, `PixelCanvasView.svelte` uses the Pointer Events API but has no multi-touch (multiple pointerId) tracking. Since `touch-action: none` blocks default browser gestures, custom pinch-zoom and two-finger pan must be implemented.

This addresses Issue 1 (multi-touch pinch zoom not working) and Issue 2 (no panning without physical keyboard) from touch-mobile-analysis.en.md.

### Implementation Plan

#### 1. Add Pointer Tracking System (PixelCanvasView.svelte)

Track active pointers using `Map<number, {x: number, y: number}>`.

- `onpointerdown`: Add pointer to Map
- `onpointermove` (window level): Update coordinates in Map
- `onpointerup` / `onpointercancel`: Remove from Map

Pointer coordinates are converted to canvas-local coordinates by subtracting `canvasEl.getBoundingClientRect()` from `event.clientX/Y`.

#### 2. Extend InteractionMode Type

```typescript
type InteractionMode =
  | { readonly type: 'idle' }
  | { type: 'drawing'; lastPixel: CanvasCoords | null }
  | { type: 'panning'; startX: number; startY: number }
  | {
      type: 'pinching';
      initialViewport: WasmViewport;
      initialDistance: number;
      initialMidX: number;
      initialMidY: number;
    };
```

- `initialViewport`: Viewport snapshot at gesture start — each frame computes from this baseline to prevent floating-point drift
- `initialDistance`: Initial distance between two fingers (baseline for zoom ratio)
- `initialMidX/Y`: Initial midpoint coordinates (baseline for total pan delta)

#### 3. State Transition Design

```text
idle + 1 pointer → drawing (existing)
idle + 2 pointers → pinching (transition on 2nd pointerdown)
drawing + 2nd pointer → call onDrawEnd → pinching
panning + 2nd pointer → pinching
pinching + 1 pointer lifted → idle (prevent drawing from starting)
pinching + 2 pointers lifted → idle
```

Key: When a second finger touches during drawing, immediately cancel drawing (`onDrawEnd`) and transition to pinching.

#### 4. Zoom + Pan Calculation (Drift-Free Baseline Approach)

**Recompute from initialViewport baseline each frame** (not incremental frame-to-frame).

```text
// Zoom: use distance ratio directly as zoom multiplier
currentDistance = distance(pointer1, pointer2)
newZoom = clamp(initialViewport.zoom * (currentDistance / initialDistance))

// Zoom anchor: apply zoom at initial midpoint (fixes canvas position)
zoomed = initialViewport.zoom_at_point(initialMidX, initialMidY, newZoom)

// Pan: apply total midpoint movement (current vs initial midpoint difference)
final = zoomed.pan(currentMidX - initialMidX, currentMidY - initialMidY)

onViewportChange(final)
```

Why this approach:
- `zoom_at_point(initialMid)` fixes the canvas coordinate at the initial midpoint
- `.pan(totalDelta)` applies total movement relative to the initial position
- Result: canvas content that was between the fingers at start remains between the fingers
- Computing from initialViewport baseline each frame eliminates floating-point accumulation errors

#### 5. Window-Level Event Handling

During pinching, fingers may move outside the canvas bounds. Following the existing pattern where panning is handled in `handleWindowPointerMove`, pinching is also handled at the window level.

- `handleWindowPointerMove`: Extend to handle `pinching` state in addition to `panning`
- Perform pointer Map updates and zoom/pan calculations

#### 6. PointerId-Based Processing in PointerUp

Currently `handlePointerUp()` unconditionally transitions to idle without parameters. For multi-touch, we need to know which pointer was lifted.

- `handlePointerUp(event: PointerEvent)` — extract pointerId from event
- Remove the pointer from the Map
- During pinching → transition to idle (prevent remaining finger from starting drawing)
- During drawing/panning → maintain existing behavior

#### 7. Ignore PointerLeave During Pinching

Currently `handlePointerLeave` ends drawing when in drawing mode. During pinching, pointerleave must be ignored — window-level events continue tracking.

#### 8. Minimum Distance Threshold

When `initialDistance` is very small (two fingers nearly touching), the zoom ratio becomes unstable. Apply a minimum 10px threshold — delay pinching entry until distance exceeds the threshold.

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/canvas/PixelCanvasView.svelte` | Pointer tracking Map, add pinching to InteractionMode, modify pointerdown/move/up/leave handlers, window-level pinch handling |

### Files Not Modified

- `viewport.rs` (Rust core) — existing `zoom_at_point()`, `pan()`, `clamp_zoom()` are sufficient
- `wheel-input.ts` — trackpad/mouse wheel classification remains unchanged
- `editor-state.svelte.ts` — `handleViewportChange()` already works generically

### Verification

1. **Touch device testing**: Real device or Chrome DevTools touch emulation
   - Two-finger spread → zoom in (midpoint anchor)
   - Two-finger pinch → zoom out
   - Two-finger drag → pan
   - Pinch + drag simultaneously → zoom + pan simultaneously
2. **Drawing interruption test**: Draw with one finger, add second finger → drawing cancelled, pinch mode entered
3. **Existing feature regression test**: Mouse click drawing, middle-click pan, space+drag pan, trackpad pinch zoom, mouse wheel zoom — all work as before
4. **Edge case testing**: Pinch continues when fingers move outside canvas, no drawing starts when one finger remains after pinch

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/PixelCanvasView.svelte` | Added multi-touch pinch-zoom and two-finger pan via pointer tracking Map and `pinching` interaction mode |

### Key Decisions

- **Drift-free baseline approach**: Each frame recomputes viewport from `initialViewport` snapshot rather than accumulating frame-to-frame deltas. Eliminates floating-point drift during long pinch gestures.
- **`getTwoPointersLocal()` combines retrieval and coordinate conversion**: Single `getBoundingClientRect()` call per frame instead of two separate `toCanvasLocal()` calls. Keeps the coordinate system conversion explicit in the function name.
- **No Rust core changes**: Existing `zoom_at_point()`, `pan()`, and `clamp_zoom()` composed directly — validates the self-contained core architecture.
- **Deferred pinch entry via `tryEnterPinching()`**: Called from both `handlePointerDown` and `handleWindowPointerMove` to handle the case where fingers start too close together (below 10px threshold) and then spread apart.
