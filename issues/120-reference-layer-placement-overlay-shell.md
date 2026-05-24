---
title: "Reference Layer: placement overlay shell — read-only render"
status: done
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

A viewport overlay that renders the active Reference Layer's placement rectangle and four corner handles. Read-only: no interaction yet. Drag-to-move, drag-to-scale, and keyboard nudge land in subsequent slices.

The overlay must align with the Reference underlay drawn by the shell renderer. It must not use `Document.composite()` as the source of truth, because Reference pixels are no longer part of the document pixel buffer.

Scope:

- New Svelte component layered over the canvas viewport.
- Visible only when the singleton Reference Layer is active.
- Renders:
  - placement rectangle computed from Reference placement and source natural dimensions;
  - four corner handles at the rectangle corners.
- Rectangle position must match the viewport-native Reference image underlay.
- Handles use constant screen-space size regardless of canvas zoom: about 12px desktop, 16px touch.
- The `pointerType === 'touch'` signal determines touch sizing where available.
- No pointer interaction yet.
- Subscribes to `tab.renderVersion` or equivalent state so the overlay re-renders on Document/reference mutations.
- Edge-midpoint handles remain absent because placement is uniform-scale only.

## Acceptance Criteria

- Overlay appears when the Reference Layer is active; disappears when active switches to a Pixel Layer or no Reference exists.
- The overlay rectangle traces the original-image underlay's projected footprint in viewport space.
- The overlay does not depend on Reference pixels being present in `Document.composite()`.
- Handles render at the four corners at a constant on-screen pixel size as the user zooms in/out.
- Desktop pointer renders about 12px handles; touch pointer renders about 16px handles.
- No interaction yet: clicks on overlay/handles produce no Document mutation.

## Blocked By

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)
- [106 — Reference Layer UX detail design](106-reference-layer-ux-design.md) must be read with the 2026-05-22 amendment.

## User Stories Addressed

- Visual feedback for #16 and #25.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/ReferenceLayerPlacementOverlay.svelte` | Added the read-only Reference placement overlay that projects the active Reference underlay into viewport space and renders four constant-size corner handles. |
| `src/lib/canvas/PixelCanvasView.svelte` | Wires the overlay into the canvas view, tracks pointer source for desktop/touch handle sizing, blocks draw fallthrough, and forwards viewport gestures from the overlay. |
| `src/routes/editor/+page.svelte` | Derives whether the active layer is the singleton Reference Layer and passes that state to both canvas view placements. |
| `src/lib/canvas/ReferenceLayerPlacementOverlay.svelte.test.ts` | Covers projection, active-state visibility, handle count/size, touch sizing, and read-only pointer blocking. |
| `src/lib/canvas/PixelCanvasView.svelte.test.ts` | Covers canvas-view integration, Reference/Pixels active-state switching, overlay read-only behavior, and viewport pan/pinch passthrough. |

### Key Decisions

- The overlay uses the renderer-facing `ReferenceUnderlay` rather than `Document.composite()` so the rectangle follows the original-image viewport underlay.
- Overlay pointer handling blocks draw-start fallthrough, while middle-drag, Space-drag, and touch pinch are forwarded to the existing canvas interaction path so viewport navigation still works.
- Handle sizes are fixed in screen pixels: 12px for desktop/pen and 16px after a touch pointer signal.

### Notes

- Drag-to-move, drag-to-scale, keyboard nudge, and Reference-active drawing-tool cursor/no-op behavior remain in follow-up slices.
