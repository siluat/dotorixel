---
title: "Canvas Flip — whole-document flip with Marquee co-transform (core + WASM + web)"
status: ready-for-agent
created: 2026-07-04
parent: 207-tiered-canvas-marquee-transforms.md
---

## Parent

[207 — Tiered transforms PRD](207-tiered-canvas-marquee-transforms.md)

## What to build

The first Canvas Transform vertical slice, and the tracer bullet that
establishes the tier's patterns. Add a pair of **canvas-flip operations**
(horizontal / vertical) to the core `Document`: mirror **every Pixel Layer's
every Cel** in place across the canvas axis; canvas dimensions unchanged; the
Reference Layer untouched; an active Marquee mirrored across the same axis and
clipped to the canvas (always non-empty, since the source rectangle was
in-bounds). Expose the ops through the WASM binding and the TS `Document`
facade (plus the fake), route them through a new undoable journal intent, and
wire the settings sheet's and right panel's Flip buttons to dispatch the canvas
op **always** — no Marquee-presence dispatch. Give those buttons new
canvas-scoped labels (direction: "Flip Canvas Horizontal"; exact copy follows
the existing i18n patterns) in en/ko/ja.

The SelectionActionBar and the existing marquee-aware flip operations are left
untouched in this slice — narrowing them to the Marquee tier is a later slice.

Patterns this slice establishes for the rest of the PRD: canvas-op naming, the
canvas/marquee journal-intent naming, the Marquee co-transform mapping, and the
canvas-scoped label key structure.

## Acceptance criteria

- On a multi-layer, multi-frame Document, a canvas flip mirrors every Pixel
  Layer's every Cel (asserted via pixel coordinates on more than one layer and
  more than one frame); canvas dimensions are unchanged.
- Applying the same canvas flip twice restores the original Document (identity
  round-trip).
- With a Reference Layer present, a canvas flip leaves its placement (x, y,
  scale, quarter-turn) and source untouched.
- An active Marquee is mirrored across the canvas axis so it covers the same
  (now flipped) content, and remains non-empty.
- With a Marquee active, the settings-sheet / right-panel Flip buttons still
  transform the whole canvas — they never switch to region mode.
- A canvas flip is a single Document History entry: one undo restores pixels
  and Marquee together. It stops Playback and commits a pending Floating
  Selection first (the existing mutate path).
- A canvas flip applies even while the Reference Layer is the active layer.
- New canvas-scoped labels exist in en/ko/ja; SelectionActionBar labels are
  unchanged.
- The WASM structural-compatibility check stays green; the fake document
  implements the new interface.
- Existing marquee-aware flip behavior (including via the SelectionActionBar)
  is unregressed.
- `cargo build --workspace` stays green (Apple binding untouched).

## Blocked by

None — can start immediately.
