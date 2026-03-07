# Pencil Drag Pixel Gap Problem and Line Interpolation

## Problem

When dragging the mouse quickly, not all pixels along the perceived path are filled. Gaps appear between drawn pixels.

```text
Slow drag (intended):        Fast drag (actual):
■ ■ ■ ■ ■ ■ ■               ■ · · ■ · · ■
```

## Why

`mousemove` events do not fire for every screen pixel the cursor crosses. The browser dispatches events at intervals, and the mouse can skip multiple canvas pixels between consecutive events.

```text
Time →
Event 1         Event 2         Event 3
(3, 3)          (7, 7)          (10, 9)
  ■               ■               ■
     · · ·           · · ·
     skipped         skipped
```

The current implementation calls `applyTool()` at a single coordinate per `mousemove` event, so intermediate pixels between events are missed.

## Solution: Bresenham Line Interpolation

Compute all pixels between the previous coordinate `(x0, y0)` and the current coordinate `(x1, y1)` using Bresenham's line algorithm, then fill each one.

```typescript
// Bresenham's line algorithm
function interpolatePixels(x0: number, y0: number, x1: number, y1: number): {x: number, y: number}[] {
  const pixels = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    pixels.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx)  { err += dx; y0 += sy; }
  }
  return pixels;
}
```

```text
After interpolation:
Event 1 → Event 2 → Event 3
(3,3)       (7,7)       (10,9)
  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■
  continuous line
```

### Where to Apply

Files changed:

- **`canvas.ts`**: Add `CanvasCoords` type definition, add `clearCanvas()` utility
- **`renderer.ts`**: Add `screenToCanvas()` to convert screen coordinates to canvas space
- **`tool.ts`**: Add `interpolatePixels()` pure function
- **`PixelCanvasView.svelte`**: Pass both previous and current coordinates from `drawAt()`
- **`+page.svelte`**: Call `applyTool()` for each interpolated coordinate in `handleDraw`

## Alternatives

### 1. DDA (Digital Differential Analyzer)

Same purpose as Bresenham but uses floating-point arithmetic.

```typescript
function interpolateDDA(x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const xInc = dx / steps;
  const yInc = dy / steps;
  // Iterate `steps` times, rounding to integer coordinates
}
```

| Aspect | Bresenham | DDA |
|--------|-----------|-----|
| Arithmetic | Integer only | Floating-point |
| Result | Deterministic | Possible accumulation error |
| Complexity | Similar | Similar |

At 32x32 scale the practical difference is negligible, but Bresenham is deterministic and the established standard for pixel art tools.

### 2. `getCoalescedEvents()` (Browser API)

Recovers intermediate mouse events that the browser coalesced for performance.

```typescript
canvas.addEventListener('pointermove', (e) => {
  for (const coalesced of e.getCoalescedEvents()) {
    // Use recovered intermediate coordinates
  }
});
```

- **Limitation**: Very fast drags can still produce gaps due to hardware polling rate limits. Not supported in Safari.
- **Conclusion**: Does not fundamentally solve the gap problem. Only useful as a supplement to an interpolation algorithm.

### 3. `pointerrawupdate` (Experimental API)

Receives raw OS-level pointer data to maximize event frequency.

- **Limitation**: Experimental API. Even at maximum frequency, gaps occur when the mouse moves more than 2 pixels per frame.
- **Conclusion**: Same fundamental limitation as option 2.

### This project's choice: Bresenham

| Approach | Guarantees no gaps | Reusability |
|----------|:-:|:-:|
| Bresenham | Yes | Reuse for Phase 2 Line tool |
| DDA | Yes | Reuse for Phase 2 Line tool |
| `getCoalescedEvents()` | Partial | None |
| `pointerrawupdate` | Partial | None |

Event-based approaches (2, 3) cannot guarantee gap-free drawing regardless of event frequency — if the mouse moves more than 2 pixels between frames, gaps will occur. An interpolation algorithm is essential. Since the Phase 2 roadmap includes "Line tool (Bresenham)", implementing Bresenham now allows code reuse.

## Open Source Case Studies

### Aseprite (C++)

The most popular pixel art editor. Selects between two Bresenham variants based on context.

- **`algo_line_continuous`**: Default for pencil drag. Alois Zingl's Bresenham variant using `e2 = 2 * err` for independent x/y step decisions.
- **`algo_line_perfect`**: Used with Snap to Grid and similar constraints. Traditional error accumulation approach.
- Also provides `_with_fix_for_line_brush` variants to prevent brush gaps at diagonal transitions.

Source: `src/doc/algo.cpp`, `src/app/tools/intertwine.cpp`

### Piskel (JavaScript)

Web-based pixel editor. The closest analogue to dotorixel's current architecture.

- `SimplePen.js` detects fast drags by checking if the coordinate difference between previous and current positions exceeds 1.
- Calls `PixelUtils.getLinePixels()` for Bresenham interpolation.
- Applies `applyToolAt()` for every interpolated coordinate.

Source: `src/js/tools/drawing/SimplePen.js`, `src/js/utils/PixelUtils.js`

### LibreSprite (C++, Aseprite fork)

- Uses Bresenham-based `algo_line()` derived from the Allegro graphics library.
- Optimized implementation using macros to handle all eight directional cases.

Source: `src/doc/algo.cpp`

**All three reviewed projects use Bresenham.** Among these case studies, no DDA or purely event-based approaches were found.

## Reference

- [Wikipedia: Bresenham's line algorithm](https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm)
- [Zingl, A. - A Rasterizing Algorithm for Drawing Curves](https://zingl.github.io/bresenham.html)
- [MDN: PointerEvent.getCoalescedEvents()](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents)
