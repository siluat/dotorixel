---
title: "Frame operations UI — add / duplicate / delete / reorder"
status: ready-for-agent
created: 2026-06-18
parent: 186-frame-management.md
---

# Frame operations UI — add / duplicate / delete / reorder

## Parent

[186 — Frame management (add/delete/duplicate/reorder) — M4 entry](186-frame-management.md)

## What to build

Complete PRD 186 by wiring the frame mutations into the ruler shell (191): the
user can add, duplicate, delete, and reorder frames, with undo/redo, persistence,
and an E2E tracer. This is the end-to-end demoable slice.

Per the [187 design spec](187-frame-ruler-design.md):

- A **header-right frame-action group**, prefixed with a `Frames` label
  (mirroring the left `Layers` label to resolve the two-`＋` ambiguity), acting on
  the **active frame**: `＋` add (empty frame), `⧉` duplicate, `🗑` delete, then
  the collapse chevron. Header **left is unchanged from M3** (add-layer `＋`,
  add-reference-layer `▣`, `Layers` label). On mobile the collapse chevron is
  dropped (the Timeline tab is the toggle).
- **Add** inserts a transparent frame after the active frame and makes it active
  (so the user can draw immediately); **duplicate** clones the active frame's full
  composite after it and makes it active; **delete** removes the active frame
  (rejected when only one remains, leaving an adjacent frame active).
- **Reorder** frames by dragging their ruler cell, reusing the layer-row
  drag-reorder pattern; the frame that was active stays active after the reorder.
- All four operations route through the journal intents from 189 (undoable) and
  persist via V6 (190); undo/redo restores both frame structure and per-cel
  pixels.
- New i18n keys for the frame actions in en / ko / ja.

## Acceptance criteria

- The header frame-action group (add / duplicate / delete) is present with the
  `Frames` label; the left layer actions and `Layers` label are unchanged.
- Add inserts an empty frame after the active frame and makes it active; the
  canvas is blank and ready to draw.
- Duplicate inserts a copy of the active frame's composite after it and makes it
  active.
- Delete removes the active frame and activates an adjacent one; delete is
  disabled/rejected when only one frame remains.
- Dragging a frame's ruler cell reorders frames; the previously-active frame
  remains active after the reorder.
- Each operation is a single undo step; undo restores the prior frame structure
  and pixels exactly, redo re-applies; selecting a frame is never an undo step.
- New frames and their per-cel pixels survive a page refresh.
- Frame action labels are localized in en / ko / ja.
- An E2E flow passes: add a frame, draw distinct content on it, switch frames and
  confirm the canvas differs, undo restores.

## Blocked by

- [191 — Frame ruler shell + selection (TimelinePanel)](191-frame-ruler-shell.md)
