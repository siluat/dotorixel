---
title: "Onion skin transport toggle + ghost treatment — design (.pen)"
type: design
status: ready-for-agent
created: 2026-07-05
parent: 217-onion-skinning.md
---

## Parent

[217 — Onion skinning — adjacent-frame ghosts while editing (M4)](217-onion-skinning.md)

## What to build

The leading `.pen` design slice for PRD 217, sibling to the 187 / 194 / 200 design
slices: a finalized spec frame in the FEATURE SPECS band of the Pencil canvas that the
implementation slices (219, 220) build against. Run via `/ui-design`; read the pencil
canvas guide first and reuse existing `$--*` tokens — no new tokens without approval.

Design decisions this spec must resolve:

- **Transport toggle**: icon choice, position within the transport strip (relative to
  Loop and the position readout), idle / pressed / disabled treatments, tooltip and
  accessible label, light + dark, and the mobile Timeline-tab variant (≥44px touch
  target inside the 56px strip).
- **Ghost treatment**: the exact warm tint (previous frame) and cool tint (next frame)
  values drawn from existing tokens, the ghost alpha level, and how tint + dimming
  compose so ghosts read clearly against the checkerboard while committed artwork
  stays unmistakably on top. Include a worked canvas mock showing an Active Frame with
  a previous and a next ghost.
- **Disabled state** at a single frame, matching the strip's existing Play/Loop
  convention.
- **Theme note** (from the PRD): the canvas backdrop is theme-independent, so ghost
  tints are single values legible on the checkerboard, not theme-paired tokens.

## Acceptance criteria

- A finalized spec frame lands in the FEATURE SPECS band, named per the canvas guide
  conventions, covering: anatomy, toggle states (idle / on / disabled), desktop
  light + dark, mobile Timeline tab (≥44px), and the ghost tint/alpha spec with token
  references.
- Previous vs next ghosts are visually distinguishable (warm vs cool) and both are
  clearly dimmer than committed artwork in the worked mock.
- Accessibility is specified: `aria-pressed` toggle semantics, focus treatment per
  existing editor conventions.
- No new design tokens introduced without explicit approval.
- The pencil canvas guide docs (band map, spec↔issue map) and the `00 — CANVAS GUIDE`
  frame are updated.
- Human design review completed (HITL slice).

## Blocked by

None — can start immediately (runs in parallel with 219). Unblocks 220.
