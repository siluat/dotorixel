---
title: Pixel Perfect — Pencil integration (hardcoded ON)
status: done
created: 2026-04-18
parent: 069-pixel-perfect-drawing.md
---

## What to build

Extend `DrawingOps` so the Web shell uses the Rust filter, and implement the PP wrapper factory. The tool-runner applies the PP wrapper to Pencil strokes with **hardcoded ON**. At the end of this slice, the user can verify — both visually and via E2E — that middle pixels are automatically removed from L-shapes drawn with the Pencil. Toggle UI and preference aren't here yet (introduced in the next step).

See the parent PRD's "Web Shell: DrawingOps extension", "Web Shell: Pixel Perfect Wrapper", and "Web Shell: Tool Runner integration" sections.

## Acceptance criteria

- `DrawingOps.applyStroke(pixels: Int32Array, kind: ToolKind, color: Color)` contract added, with a default implementation (simple loop + `applyTool`)
- `DrawingOps.setPixel(x, y, color)` low-level write method added (for revert, tool-kind agnostic)
- pencil-tool switches from per-segment `for` loop to `applyStroke`
- `createPixelPerfectOps(baseOps): DrawingOps` factory as a new module
  - Internal state: 2-point tail + pre-paint cache `Map<PackedCoord, Color>`
  - `applyStroke` implementation: call Rust `pixel_perfect_filter` → execute actions in order
    - `Paint`: if not in cache, record the current canvas color (first-touch wins), then `baseOps.applyTool`
    - `Revert`: read from cache and restore via `baseOps.setPixel`
  - Non-stroke calls (e.g., `applyTool`) are forwarded
- tool-runner **unconditionally** applies the PP wrapper on pencil `drawStart` (no preference lookup)
- `drawEnd()` drops the stroke wrapper
- TS unit tests (Vitest + happy-dom):
  - first-touch wins: revisit of the same coordinate does not overwrite the cache
  - On revert, the correct pre-paint color is restored
- E2E 1 case (Playwright): Pencil L-shape drag → no middle pixel
- `cargo test`, Vitest, and Playwright all pass

## Blocked by

- [071 — Pixel Perfect filter Rust core function](071-pixel-perfect-rust-filter.md)

## Scenarios addressed

- Scenario 1 (Pencil PP ON L-shape middle absent)
- Scenario 4 (horizontal/vertical line preservation)
- Scenario 5 (single tap)
- Scenario 6 (undo single entry)
- Scenario 8 (start-time snapshot foundation — here hardcoded ON means no value-change to begin with)
- Scenario 10 (shell-side handling of self-intersection first-touch wins)
- Scenario 12 (input-device-agnostic)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/drawing-ops.ts` | Added `applyStroke` / `setPixel` / `getPixel` methods (contract supports decoration) |
| `src/lib/canvas/wasm-backend.ts` | WASM-backed default implementations for the new methods (with out-of-bounds guards) |
| `src/lib/canvas/pixel-perfect-ops.ts` | `createPixelPerfectOps` decorator factory — tail + first-touch cache + seam dedup |
| `src/lib/canvas/pixel-perfect-ops.test.ts` | Vitest 4 cases: L-corner revert, segment boundary, seam overlap, first-touch wins |
| `src/lib/canvas/draw-tool.ts` | Added `ToolContext.ops` field — stroke-scoped DrawingOps injection |
| `src/lib/canvas/tools/pencil-tool.ts` | Uses `ctx.ops.applyStroke` instead of the `for` loop; pencil/eraser share the same factory |
| `src/lib/canvas/tool-registry.ts` | Changed pencil/eraser to singletons (no factory args needed) |
| `src/lib/canvas/tool-runner.svelte.ts` | Create PP wrapper on drawStart for pencil/eraser, drop on drawEnd |
| `e2e/editor/fixtures.ts` | Extracted `readArtGeometry` as an exportable helper; split `findArtCenter` out as `artCenterFromGeometry` |
| `e2e/editor/pixel-perfect.test.ts` | E2E: verifies that after a Pencil L-shape drag, the corner pixel is restored to its initial color |

### Key Decisions

- **Decorator pattern over filter pipeline**: wraps `DrawingOps` itself, so tool code works without knowing about PP. The `tool-runner`'s `drawStart` swaps in `strokeOps`.
- **`ToolContext.ops` injection**: tools no longer capture `ops` at construction time; they read `ctx.ops` per call → stroke-scoped wrapper swapping works naturally.
- **Seam dedup at the wrapper level**: The WASM filter contract is "distinct stroke pixel stream". However, pencil's Bresenham segments include both endpoints, so the junction pixel is duplicated between adjacent batches. The wrapper's `dedupAgainstTail` absorbs this and preserves the WASM contract.
- **Hardcoded ON for pencil AND eraser**: Until the 074 toggle is introduced, both tools auto-apply. The tool-runner branches on `activeTool === 'pencil' || activeTool === 'eraser'`.
- **First-touch-wins via `Map<string, Color>`**: cache key is `"x,y"` string. On coordinate revisit, `cache.has()` check preserves only the first color.

### Notes

- As a side effect, **most of 073 (Eraser integration)'s requirements are already implemented**: pencil/eraser share the same `createFreehandTool` factory and the tool-runner routes both. Only adding the eraser-specific E2E case remains in 073.
- While debugging, discovered that the WASM filter's `is_l_corner` requires `prev != next` on both axes, so duplicates silently break L detection. Resolved at the wrapper via dedup; future Apple shell integration will need the same dedup responsibility there.
- The pre-paint cache persists until stroke end, so memory usage can grow for very long strokes. Within practical limits for now. Time-based expiration can be considered later.
