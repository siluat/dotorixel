---
title: Apple native — HSV picker in the color section
status: done
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

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Extensions/Color+Hsv.swift` | `HsvColor` + RGB↔HSV conversion, mirroring web `color.ts` math; shell-side per Core Placement |
| `apple/Dotorixel/Views/HsvPickerModel.swift` | UI-independent picker state: SV/hue edits, external-color sync, achromatic hue preservation, own-echo guard |
| `apple/Dotorixel/Views/HsvPickerView.swift` | SwiftUI picker: gradient-composed SV square + hue strip, drag gestures, 44pt hue hit area |
| `apple/Dotorixel/Views/RightPanel.swift` | Color section reordered to web parity (FG/BG → HSV → Palette → Recent); system `ColorPicker` removed |
| `apple/Dotorixel/Extensions/Color+SwiftUI.swift` | Removed now-unused `Color(resolved:)` bridge (only consumer was the system `ColorPicker`) |
| `apple/DotorixelTests/HsvColorTests.swift` | Round-trip over the full default palette + achromatic edge cases |
| `apple/DotorixelTests/HsvPickerModelTests.swift` | SV/hue edit, external reposition, achromatic-sync hue preservation, echo-ignore behaviors |
| `apple/DotorixelTests/DockedRegionSnapshotTests.swift` | `stripHeight` 480 → 560 so the taller color section (picker +140pt) fits; 5 vertical-strip baselines re-recorded on the pinned host |

### Key Decisions

- **SV square and hue strip are `LinearGradient` compositions**, not pixel
  renders — the web draws the same two-gradient stack onto canvases; SwiftUI
  expresses it declaratively with identical output.
- **Own-echo guard (`lastSyncedColor`)**: re-deriving HSV from the picker's own
  emitted (quantized) RGB would drift the thumb — e.g. hue 350 at s=0.01 snaps
  to 0. Mirrors the web's `lastSyncedHex`; pinned by a regression test.
- **Hue strip hit area**: visual stays 20pt (web parity) inside a 44pt-wide
  gesture container (HIG minimum for iPad touch), as the issue allowed.

### Notes

- The web's read-only hex display row (`.hex-row`) between FG/BG and the HSV
  title is not part of this issue; registered as follow-up
  [249 — hex display row](249-apple-hex-display-row.md).
- Accessibility labels remain hardcoded English like the rest of the shell;
  [242 — i18n String Catalog](242-apple-i18n-string-catalog.md) localizes them.
