---
title: "Reference Layer: placement overlay — drag-to-move (body) + drag-to-scale (corner handles)"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Add pointer interaction to the placement overlay. The body translates the placement (move); the four corner handles uniformly scale the placement around the opposite corner. Pointer-drag previews live in real time without committing; on release a single Document snapshot commits via `set_reference_placement`. Escape / pointer-cancel during drag drops the preview without committing.

Scope:

- Three interaction zones:
  - **Corner handles** (drag): uniform scale around the opposite corner anchor. Cursors `nwse-resize` / `nesw-resize` per corner.
  - **Body** (inside placement, outside handles): translate (move). Cursor `move`.
  - **Outside placement**: tool default (no overlay interaction).
- **Live preview**: during drag, the overlay rectangle and the composite re-render at the in-progress placement — but no Document mutation is committed. Implementation: a local "draft placement" used by the overlay and the renderer; on release, push one Document snapshot and call `set_reference_placement`.
- **Escape / pointer-cancel** during drag drops the preview and restores the committed placement (no snapshot pushed).
- **Minimum size**: the projected placement is never allowed to shrink below 8×8 document pixels. Below the floor the drag clamps to the floor.
- **Maximum size**: unbounded. Overflow allowed.
- **Touch hit-area extension**: invisible padding around handles clears the 44pt iOS HIG touch target.

## Acceptance criteria

- Drag on body → placement translates; release commits one snapshot.
- Drag on a corner handle → placement scales uniformly around the opposite corner; release commits one snapshot.
- Cursors per zone match the table above.
- Pointer-cancel or Escape during drag → preview reverts; no snapshot pushed.
- Drag preview is live — both the overlay and the composite reflect the in-progress placement.
- Minimum projected size 8×8 — corner-drag below the floor clamps.
- Touch hit-area is at least 44pt around each handle.
- Edge-midpoint handles are not rendered.
- The committed placement matches the previewed placement at the moment of release.

## Blocked by

- [120 — placement overlay shell](120-reference-layer-placement-overlay-shell.md)

## User stories addressed

- #7, #9, #31.
