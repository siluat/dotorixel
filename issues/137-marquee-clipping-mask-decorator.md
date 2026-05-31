---
title: "Marquee clipping mask — DrawingOps decorator + drawing tool integration"
status: done
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

A single `DrawingOps` decorator that clips every drawing tool's output to the active Marquee bounds. Pencil, Eraser, Line, Rectangle, Ellipse, and Flood Fill gain Marquee awareness for free through host-layer composition — no per-tool changes.

Scope:

- **`drawing-ops.ts` decorator (new)**: `createMarqueeClippedOps(baseOps, marquee)` wraps a `DrawingOps`:
  - `setPixel(x, y, color)` — drops writes outside Marquee.
  - `applyTool(x, y, tool, color)` — drops out-of-Marquee writes.
  - `applyStroke(pixels, tool, color)` — filters the pixel batch to in-Marquee coordinates before forwarding.
  - `floodFill(x, y, color)` — treats Marquee edges as fill bounds by clipping the WASM fill bounds. Seed outside Marquee no-ops.
  - When no Marquee is active, the decorator is a pass-through (identity).
- **Host composition** (`tool-authoring.ts`): at stroke begin, the host composes ops as `marqueeClip(pixelPerfect(baseOps))` when both are active. The composition order is fixed.
- **Tools that bypass `DrawingOps`** keep their semantics unchanged:
  - **Move tool (V)** continues to call `shiftPixels` directly — full-layer translate, Marquee has no effect.
  - **Eyedropper** continues to sample anywhere — read-only, Marquee has no effect.

Implementation notes:

- The decorator is created per-stroke against the current Marquee snapshot. Mid-stroke Marquee mutations are ignored (consistent with the pixel-perfect snapshotting pattern).
- For Flood Fill, the WASM fill function gains an optional bounds parameter; when present, the fill stops at the bounds. If the bounds parameter is impractical to add to the WASM API in this slice, the TS decorator can post-process the fill result by intersecting with the Marquee — confirm the chosen path during implementation.

Tests:

- `setPixel` / `applyTool` / `applyStroke` / `floodFill` each tested in-Marquee writes through, out-of-Marquee drops.
- Composition test: `pixelPerfect(baseOps)` wrapped by `marqueeClip` — the pixel-perfect filter sees the marquee-clipped output, not raw pencil output.
- No-Marquee test: decorator is pass-through.
- Integration tests for each affected drawing tool (pencil, eraser, line, rectangle, ellipse, floodfill) showing the clip applies end-to-end through the stroke session.

## Acceptance criteria

- All drawing-tool pixel writes are clipped to the active Marquee bounds.
- Move tool (V) ignores the Marquee — full-layer translate behavior preserved.
- Eyedropper ignores the Marquee — sampling anywhere preserved.
- Flood Fill seed inside Marquee fills only inside; seed outside no-ops.
- Decorator is identity when no Marquee is active.
- `pixelPerfect(marqueeClip(baseOps))` composition order (marquee-clip outermost) verified.

## Blocked by

- [132 — Selection foundation](132-selection-foundation.md)

## Results

| File | Description |
|------|-------------|
| `crates/core/src/canvas.rs` | Added bounded flood-fill support using rectangular limits while keeping canvas independent of Selection types. |
| `crates/core/src/document.rs` | Routed active-layer bounded flood fill through Document so selection bounds apply to Pixel Layers and Reference Layers remain no-op. |
| `wasm/src/lib.rs` | Exposed bounded flood-fill bindings for both Document and raw canvas paths. |
| `src/lib/canvas/drawing-ops.ts` | Added the Marquee clipping decorator and bounds-aware DrawingOps contract. |
| `src/lib/canvas/tool-authoring.ts` | Composed per-stroke drawing ops so active Marquees clip drawing tools at stroke start. |
| `src/lib/canvas/wasm-backend.ts` | Forwarded optional Marquee bounds through WASM-backed DrawingOps and tee operations. |
| `src/lib/canvas/fake-drawing-ops.ts` | Updated fake DrawingOps to model bounded flood fill for tests. |
| `src/lib/canvas/marquee-clipped-ops.test.ts` | Covered decorator pass-through, write filtering, stroke filtering, and flood-fill seed behavior. |
| `src/lib/canvas/continuous-tool.test.ts` | Covered Marquee-aware host composition for continuous tools. |
| `src/lib/canvas/stroke-engine.test.ts` | Covered Pencil, Eraser, Shape tools, Flood Fill, Move, and Eyedropper behavior with active Marquees. |

### Key Decisions

- Implemented Flood Fill clipping in Rust core/WASM instead of duplicating flood-fill traversal in TypeScript, keeping the drawing algorithm authoritative in core.
- Kept Move and Eyedropper outside the Marquee clipping path because they intentionally bypass `DrawingOps`: Move translates the full active layer, and Eyedropper is read-only sampling.

### Notes

- The clipping decorator snapshots the Marquee at stroke start, matching the existing pixel-perfect stroke composition behavior.
