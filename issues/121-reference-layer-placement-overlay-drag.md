---
title: "Reference Layer: placement overlay — drag-to-move (body) + drag-to-scale (corner handles)"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Add pointer interaction to the placement overlay. The body translates the Reference underlay placement; the four corner handles uniformly scale the placement around the opposite corner. Pointer-drag previews live in real time without committing; on release a single Document snapshot commits via `set_reference_placement`. Escape / pointer-cancel during drag drops the preview without committing.

Scope:

- Three interaction zones:
  - **Corner handles**: drag to uniform-scale around the opposite corner anchor. Cursors `nwse-resize` / `nesw-resize` per corner.
  - **Body**: drag to translate. Cursor `move`.
  - **Outside placement**: tool default; no overlay interaction.
- Live preview: during drag, the overlay rectangle and Reference underlay re-render from a local draft placement. `Document.composite()` is not involved.
- On release, push one Document snapshot and call `set_reference_placement`.
- Escape / pointer-cancel during drag drops the draft placement and restores the committed placement with no snapshot.
- Minimum projected size: clamp to 8x8 document pixels.
- Maximum size: unbounded; overflow is allowed and clipped by the viewport/document frame.
- Touch hit-area extension: invisible padding around handles clears the 44pt iOS HIG target.

## Acceptance Criteria

- Drag on body translates the Reference underlay; release commits one snapshot.
- Drag on a corner handle scales uniformly around the opposite corner; release commits one snapshot.
- Cursors per zone match the scope above.
- Pointer-cancel or Escape during drag reverts preview and pushes no snapshot.
- Drag preview is live: both overlay and underlay reflect the in-progress placement.
- Preview/commit do not require Reference pixels in `Document.composite()`.
- Minimum projected size 8x8; corner-drag below the floor clamps.
- Touch hit-area is at least 44pt around each handle.
- Edge-midpoint handles are not rendered.
- The committed placement matches the previewed placement at release.

## Blocked By

- [120 — placement overlay shell](120-reference-layer-placement-overlay-shell.md)

## User Stories Addressed

- #11, #13, #25.
