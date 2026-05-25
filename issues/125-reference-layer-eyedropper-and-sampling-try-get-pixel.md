---
title: "Reference Layer: eyedropper and Canvas Sampling sample active layers explicitly"
status: done
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Implement eyedropper and Canvas Sampling Sessions for the corrected Reference Layer model: Reference is a viewport underlay, not a document pixel buffer. Eyedropper and sampling support color extraction from a Reference Layer's visible source image, but through explicit source-image sampling paths rather than `Document.composite()`.

This restores the intended active-layer sampling model: Pixel-active sampling reads Pixel Layer document pixels, and Reference-active sampling reads the placed Reference source image.

Scope:

- Eyedropper/Sampling Sessions use an optional active-layer read path: readable opaque pixel -> commit color; no readable pixel -> no-op.
- With Reference active, eyedropper and sampling sample the Reference source image through its placement in original source-image coordinates.
- Reference-active Loupe movement uses sub-document-pixel pointer targets so the source image can be inspected precisely even when the placed Reference is scaled below one document pixel per source pixel.
- With Reference active, transparent or out-of-footprint samples are no-ops and do not show error UI.
- With Pixel active, existing eyedropper and sampling behavior remains unchanged except where out-of-bounds reads are made explicitly optional/no-op.
- No fall-through to lower Pixel Layers or viewport composite.
- Reference source sampling must not imply that Reference pixels are part of artwork pixels.

## Acceptance Criteria

- With Pixel active, eyedropper inside document bounds commits the sampled color.
- With Pixel active, out-of-bounds sampling is a silent no-op.
- With Reference active, eyedropper/sampling over an opaque source pixel commits the sampled color.
- With Reference active, the Loupe grid tracks original source-image pixels rather than a pixelized document projection.
- Reference-active transparent, out-of-footprint, or out-of-document sampling is a silent no-op.
- No Reference source pixels are read through `Document.composite()`.
- No error toast or console error on silent-no-op cases.
- Tests cover Pixel-active success, Pixel-active optional/no-op, Reference-active success, and Reference-active optional/no-op.

## Blocked By

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)
- [124 — drawing tools no-op + cursor](124-reference-layer-drawing-tools-no-op-and-cursor.md)

## User Stories Addressed

- Keeps sampling behavior safe under #16 while preserving expected color extraction from reference images.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/document.rs` | Keeps `Document.composite()` Pixel-only while exposing document-coordinate Reference source sampling through the active-layer optional read. |
| `wasm/src/lib.rs` | Updated the WASM facade contract and regression coverage for Pixel and Reference sampling. |
| `src/lib/canvas/canvas-model.ts` | Clarified the `Document` active-layer sampling contract and split continuous document points from discrete canvas pixels. |
| `src/lib/canvas/sampling/ports.ts` | Extended the Sampling Port contract to represent in-bounds cells with no readable pixel. |
| `src/lib/canvas/sampling/adapters/document.ts` | Added a Document-backed Sampling Port for Canvas Sampling Sessions. |
| `src/lib/canvas/sampling/sample-grid.ts` | Preserved null grid cells and floors fractional centers before reading Sampling Ports. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Routes Reference-active sampling through a source-image Sampling Port. |
| `src/lib/canvas/sampling/adapters/reference-underlay.ts` | Samples Reference Layer Loupe grids in original source-image coordinates instead of document-pixel coordinates. |
| `src/lib/canvas/stroke-engine.ts` | Allows Reference-active Eyedropper strokes while drawing tools still no-op. |
| `src/lib/canvas/PixelCanvasView.svelte` | Forwards Eyedropper pointer events through the Reference placement overlay while preserving move, scale, and pan handling. |
| `src/lib/canvas/canvas-interaction.svelte.ts`, `src/lib/canvas/viewport.ts` | Keep drawing tools on discrete canvas pixels while letting Reference sampling receive typed sub-document-pixel pointer targets. |
| `src/lib/canvas/**/*test.ts` | Added regressions for Pixel-active success/no-op, Reference-active Eyedropper sampling, Reference-active long-press sampling, source-coordinate Loupe grids, smooth Reference pointer movement, nullable Sampling Port cells, and fractional center flooring. |
| `CONTEXT.md` | Updated the Sampling Port and Canvas Sampling Session vocabulary. |

### Key Decisions

- Canvas Sampling Sessions adapt the active `Document` through an explicit active-layer sampling port rather than treating the whole Document as a Sampling Port.
- Reference-active Eyedropper and long-press sampling use the same session lifecycle as Pixel sampling, but swap in a Reference source-image port and sub-document-pixel target mapping below that lifecycle.
- Source-image reads never go through composite/export data.

### Notes

- Reference source sampling is intentionally limited to color extraction. Drawing tools still cannot mutate Reference source data.
