---
title: Apple native — Shift constrain + constrain latch for shape tools
status: ready-for-agent
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color. (Re-sequenced here from Phase 1 — there was nothing to
constrain before the shape tools existed.)

## What to build

Bring the web's **Shift-constrain** behavior to the Apple shape tools, plus the
touch-first **constrain latch** for devices without a Shift key:

- **Line + Shift**: the endpoint snaps to the nearest 45° multiple from the
  anchor (8-directional).
- **Rectangle/Ellipse + Shift**: the bounding box is forced square (circle).
- **Constrain latch**: a sticky toolbar toggle that supplies the same held state
  without a keyboard — the primary affordance on iPad, a clickable convenience on
  Mac. Shown/enabled in LeftToolbar when the active tool is constrainable; the
  active constrainable tool button carries a small badge while the latch is on
  (web LeftToolbar is the reference). Session-transient: resets to off on
  relaunch, mirroring how a held key is never remembered.

The two sources are **OR-combined at the single seam** the shape sessions read
("is constrain held?") — from a tool's perspective, the latch is
indistinguishable from physical Shift. Mid-stroke changes (pressing/releasing
Shift, tapping the latch) re-render the in-flight preview immediately via the
session's modifier-refresh hook from 230.

The constraint math mirrors the web's shell-side functions (`constrainLine`,
`constrainSquare`): snap the current point before computing the preview. The web
deliberately keeps this in shell code, not the shared core — simple, stable
math; implement the Swift equivalents (unit-tested against the web's cases).

Platform scope for the physical key: macOS Shift (modifier flags) and iPad
hardware-keyboard Shift if the event path surfaces it; the latch covers all
other input.

## Acceptance criteria

- Holding Shift (macOS) while dragging a line snaps it to 0°/45°/90°/…; while
  dragging a rectangle/ellipse forces a square/circle; releasing Shift mid-drag
  relaxes the preview immediately, re-pressing re-constrains.
- The latch button toggles on/off, only applies when a constrainable tool is
  active, and produces identical constrained results to holding Shift, including
  turning it on/off mid-drag.
- The latch state is visible (button state + badge on the active tool button)
  and resets on app relaunch.
- Pencil/eraser/fill/eyedropper/move ignore the constrain state.
- Constraint math unit-tested (45° snapping quadrants, square normalization with
  negative drags); toolbar snapshot baselines updated for the latch.

## Blocked by

- [231 — shape tools](231-apple-shape-tools.md)
