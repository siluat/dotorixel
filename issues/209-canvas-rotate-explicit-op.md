---
title: "Canvas Rotate — explicit whole-document op with Marquee co-transform (core + WASM + web)"
status: ready-for-agent
created: 2026-07-04
parent: 207-tiered-canvas-marquee-transforms.md
---

## Parent

[207 — Tiered transforms PRD](207-tiered-canvas-marquee-transforms.md)

## What to build

Following the patterns established by issue 208, add a pair of **canvas-rotate
operations** (CW / CCW) that always turn the whole Document — every Pixel
Layer's every Cel rotated, canvas width/height swapped — with no
Marquee-presence dispatch, and **co-rotate an active Marquee** through the same
quarter-turn into the swapped dimensions, clipped to the new canvas (new
behavior: today a Marquee diverts rotate into region mode). The Reference
Layer's existing rotate-along behavior is **kept unchanged** in this slice —
excluding it is issue 206's job, layered on top of this op.

Expose the ops through the WASM binding and the TS `Document` facade (plus the
fake), route them through new undoable journal intents, wire the settings
sheet's and right panel's Rotate buttons to them, and add canvas-scoped labels
(direction: "Rotate Canvas Right"; exact copy follows the existing i18n
patterns) in en/ko/ja. The SelectionActionBar and the existing marquee-aware
rotate operations are left untouched.

## Acceptance criteria

- With a Marquee active, the settings-sheet / right-panel Rotate buttons rotate
  the whole Document: every Pixel Layer's every Cel turns and the canvas
  width/height swap — never region mode.
- An active Marquee is carried through the same quarter-turn into the swapped
  dimensions, covers the same (now rotated) content, and remains non-empty.
- Four consecutive canvas rotates (CW×4 or CCW×4) restore pixels, dimensions,
  and the Marquee (identity round-trip).
- A canvas rotate is a single Document History entry: one undo restores pixels,
  dimensions, and Marquee together. It stops Playback and commits a pending
  Floating Selection first.
- A canvas rotate applies even while the Reference Layer is the active layer.
- The Reference Layer still turns with the canvas exactly as before — the
  existing whole-document rotate reference tests stay green (issue 206 changes
  this afterwards).
- New canvas-scoped labels exist in en/ko/ja; SelectionActionBar labels are
  unchanged.
- The WASM structural-compatibility check stays green; the fake document
  implements the new interface.
- Existing marquee-aware rotate behavior (including via the SelectionActionBar)
  is unregressed.
- `cargo build --workspace` stays green (Apple binding untouched).

## Blocked by

- [208 — Canvas Flip](208-canvas-flip-whole-document.md) (establishes the
  canvas-op, journal-intent, co-transform, and label patterns)
