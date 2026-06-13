---
title: "Rotate region 90° clockwise & counter-clockwise"
status: ready-for-agent
created: 2026-06-14
parent: 176-flip-and-rotate-transforms.md
---

# Rotate region 90° (CW & CCW)

## Parent

[176 — Flip & rotate transforms](176-flip-and-rotate-transforms.md)

## What to build

Add **90° rotation of the selected region** (clockwise and counter-clockwise) for
the active Pixel Layer, extending the transform pipeline established in #177.
This slice handles the **Marquee path only**; whole-document rotation (no
Marquee) arrives in #179.

Behaviour:

- With a **Marquee active** on a Pixel Layer, rotating 90° turns the region's
  content: a `W×H` region's pixels are rotated into an `H×W` block,
  **re-centered on the original region's center** and clipped to the canvas
  (pixels that fall outside the canvas are lost). The Marquee updates to wrap the
  new `H×W` region.
- Implement via the existing region seams: lift the region buffer, rotate the
  buffer (`W×H → H×W`), clear the original region, composite the rotated buffer at
  the new re-centered region, and return the new (clipped) region so the Document
  can update its Marquee.
- With the active layer being a **Reference Layer**, region rotate is a silent
  no-op.
- With **no Marquee**, rotate is a no-op in this slice (it captures no snapshot);
  the no-Marquee path is wired in #179.
- Each rotation is a single undoable step; redo re-applies it.

New journal intents `rotate-cw` / `rotate-ccw` (no payload; guarded to
Marquee-present + active Pixel Layer in this slice). Entry point: **rotate buttons
in the SelectionActionBar** (Lucide `RotateCw` / `RotateCcw`). RightPanel rotate
buttons are intentionally **not** added yet — they would be dead without the
no-Marquee path, and arrive in #179. i18n keys added across en / ko / ja
(e.g. `action_transformRotateCw`, `action_transformRotateCcw`).

## Acceptance criteria

- Rotate CW and CCW are available from the SelectionActionBar when a Marquee is
  active on a Pixel Layer.
- A `W×H` region's pixels rotate into an `H×W` block re-centered on the region's
  center and clipped to the canvas; the Marquee updates to the new region.
- The lift → rotate → clear → composite round-trip is correct: content that moves
  out of the original footprint leaves transparency behind, and a CW then CCW of
  the same region restores the original pixels and Marquee.
- With a Reference Layer active, region rotate is a silent no-op.
- With no Marquee, rotate is a no-op (no snapshot captured) in this slice.
- Each rotation is a single undo step; undo restores prior pixels and Marquee,
  redo re-applies.
- Button labels are localized in en / ko / ja.
- Rust unit tests cover: buffer rotate CW/CCW, CW∘CCW identity, CW×4 identity;
  region rotate re-centering and clipping, the returned region, and edge /
  partial-overlap cases.
- Journal tests cover: one snapshot per rotation, undo restores pixels + Marquee,
  and the Reference-active / no-Marquee guards suppress the snapshot.
- Component tests cover: the SelectionActionBar rotate actions render and invoke
  their handlers with localized labels.

## Blocked by

- [177 — Flip horizontal & vertical](177-flip-horizontal-vertical.md)
