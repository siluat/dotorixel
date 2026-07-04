---
title: "Marquee Transform — explicit region ops, drop the Marquee-presence dispatch (core + WASM + web)"
status: ready-for-agent
created: 2026-07-04
parent: 207-tiered-canvas-marquee-transforms.md
---

## Parent

[207 — Tiered transforms PRD](207-tiered-canvas-marquee-transforms.md)

## What to build

The closing slice: with the settings sheet and right panel now dispatching the
Canvas Transform ops (208 / 209), narrow the original flip/rotate operations to
the **Marquee Transform tier**. Remove the Marquee-presence dispatch and the
now-unreachable no-Marquee branches (the old active-cel flip and the
whole-document rotate path inside the legacy ops), and align the operation and
journal-intent names with the Marquee Transform domain term. The
SelectionActionBar dispatches these marquee ops explicitly. A marquee op stays
a no-op without a Marquee or while a Reference Layer is active — and a no-op
must not push a History entry or mark the Document dirty.

Align the facade doc comments and the fake document with the two-tier contract,
and update the platform-status Flip/transform row's note to describe the tiers.

## Acceptance criteria

- The SelectionActionBar's flip/rotate transform only the Marquee region of the
  active Pixel Layer's active-frame Cel — existing region behavior is
  unregressed (flip keeps the Marquee position; rotate re-centers the `H×W`
  block, clips to the canvas, and updates the Marquee to wrap it).
- A select-all Marquee plus a marquee flip mirrors a single layer's active
  Cel — the old single-cel flip capability remains achievable.
- A marquee op without a Marquee, or while a Reference Layer is active, leaves
  the Document unchanged and pushes no undo entry / dirty mark.
- No transform operation changes scope based on Marquee presence — the
  Marquee-presence dispatch is gone from the core, and the unreachable legacy
  branches are deleted.
- Journal intents are cleanly split into canvas and marquee variants; the WASM
  structural-compatibility check stays green; the fake document matches.
- The platform-status Flip/transform row describes the Canvas / Marquee
  Transform tiers; facade doc comments match the CONTEXT.md vocabulary.
- `cargo build --workspace` stays green (Apple binding untouched).

## Blocked by

- [208 — Canvas Flip](208-canvas-flip-whole-document.md)
- [209 — Canvas Rotate](209-canvas-rotate-explicit-op.md)
  (the trigger surfaces must already be on the canvas ops before the legacy
  ops can be narrowed to the Marquee tier)
