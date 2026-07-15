---
title: Apple native — HSV picker in the color section
status: ready-for-agent
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color.

## What to build

Replace the system `ColorPicker` in the Apple shell's color section with a
native **HSV picker** mirroring the web editor's: a saturation/value square with
a draggable thumb, plus a hue slider. It drives the foreground color.

Reference is the web's HsvPicker and the ColorsContent layout. Reorganize the
RightPanel color section toward the web's order: FG/BG preview (from 233) →
HSV picker → preset palette (→ Recent row when 237 lands; coordinate ordering
if both are in flight).

Behavior (web parity):

- Dragging in the SV square updates saturation (x) and value (y, top = bright)
  continuously; the thumb tracks the current color.
- The hue slider selects hue 0–360; changing hue re-renders the square's
  gradient while preserving the thumb's S/V position.
- Selecting a foreground color externally (palette swatch, eyedropper commit,
  swap) moves the picker's thumb and hue to match.
- Alpha is not part of the picker (always fully opaque), same as the web.

RGB↔HSV conversion is simple, stable math — implement it in Swift (the web also
keeps it shell-side; Core Placement's rule of thumb says the binding overhead
isn't warranted).

Touch targets: the thumb and slider must be comfortably draggable on iPad
(≥44pt hit areas even if the visuals are smaller).

## Acceptance criteria

- The color section shows the HSV picker in place of the system `ColorPicker`;
  section order matches the web (FG/BG → HSV → palette).
- Dragging in the SV square and the hue slider updates the foreground color live,
  and drawing uses the picked color.
- Round-trip consistency: picking any palette color positions the thumb/hue so
  that the displayed picker state reproduces that color (RGB↔HSV conversion
  unit-tested, including grayscale/black edge cases where hue is undefined).
- External foreground changes (palette tap, swap) reposition the picker.
- Usable via touch on iPad tiers; RightPanel snapshot baselines updated.

## Blocked by

- [233 — FG/BG color pair](233-apple-fg-bg-colors.md)
