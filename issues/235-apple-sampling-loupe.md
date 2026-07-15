---
title: Apple native — sampling loupe overlay for the eyedropper
status: ready-for-agent
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color.

## What to build

Add the **sampling loupe** — the magnifier overlay shown while an eyedropper
stroke is active — to the Apple shell, mirroring the web editor's loupe.

While the user drags with the eyedropper, a floating panel near the pointer
shows:

- A **9×9 pixel grid** centered on the target pixel, each cell rendered at
  loupe-cell scale with gridlines; the center cell (the one that will commit) is
  visually highlighted. Cells outside the canvas bounds render as "no pixel"
  (distinct from transparent pixels, which render like the canvas does).
- A **hex chip** below the grid: a small swatch plus the center pixel's hex
  string.

Positioning mirrors the web's rules: the loupe floats offset from the pointer —
a small symmetric offset for mouse/pencil input, a larger vertical offset for
touch (so the finger doesn't cover it) — and is clamped so it stays fully inside
the canvas area, flipping to the opposite side when it would overflow. The web's
loupe geometry constants (grid size 9, cell 24px, offsets 20px mouse / 80px
touch, etc.) are the single source of truth to mirror; keep them in one place on
the Swift side too.

The grid contents come from reading canvas pixels around the target via the
existing `get_pixel` FFI call (the web's sample-grid logic is shell-side; mirror
it in Swift — a 9×9 read per sample is cheap). The loupe appears on the first
sample of an eyedropper stroke, follows the drag, and disappears on release or
cancel.

This is a SwiftUI overlay in the canvas area — not part of the Metal render
pass.

## Acceptance criteria

- Starting an eyedropper drag shows the loupe; it follows the pointer and
  disappears on release/cancel.
- The grid shows the 9×9 neighborhood of the target pixel; the center cell is
  highlighted and matches the color that a release would commit.
- Out-of-bounds cells are visually distinct from transparent pixels.
- The hex chip shows the center pixel's hex value and tracks the drag.
- Touch input positions the loupe with the larger vertical offset; mouse input
  uses the small offset; near canvas edges the loupe flips/clamps to stay fully
  visible.
- Grid sampling and position math are unit-tested (bounds, flipping, center
  index); the loupe view has a snapshot baseline.

## Blocked by

- [234 — eyedropper tool](234-apple-eyedropper.md)
