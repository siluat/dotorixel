---
title: "Apple native: RightPanel"
status: done
created: 2026-04-06
parent: 014-apple-native-docked-layout.md
---

## What to build

Implement the RightPanel with two sections, replacing the placeholder from the layout skeleton.

**Canvas section** (top):
- Canvas size presets (same preset buttons as current TopControlsRight)
- Width/height text inputs
- Clear button (disabled — enabling is a separate Phase 1 task)

**Color section** (below divider):
- Foreground color swatch
- Palette grid (existing DefaultPalette data, 2 rows x 9 columns)
- SwiftUI ColorPicker

The panel scrolls vertically if content exceeds available height. Existing logic from the former TopControlsRight (preset selection, size input commit) and BottomColorPalette (palette selection, ColorPicker binding) is reimplemented in the new context.

## Acceptance criteria

- [x] RightPanel displays Canvas section and Color section separated by a divider
- [x] Canvas size presets update canvas dimensions on tap
- [x] Width/height text inputs commit on blur or Return
- [x] Clear button is visible but disabled
- [x] Foreground swatch shows the current drawing color
- [x] Palette grid colors are selectable and update the foreground color
- [x] SwiftUI ColorPicker updates the foreground color
- [x] Panel scrolls if content overflows vertically

## Blocked by

- [015 — Design tokens + layout skeleton](015-apple-layout-skeleton.md)

## Scenarios addressed

- Scenario 5: User adjusts canvas size via presets or text input → canvas resizes
- Scenario 6: User picks a color from palette or ColorPicker → foreground color updates

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Views/RightPanel.swift` | Full RightPanel implementation — Canvas section (presets, dimension inputs, clear button) + Color section (swatch, palette grid, ColorPicker) |
| `apple/Dotorixel/State/EditorState.swift` | Added `handleResize`, `handleSelectColor`, `handleSelectSwiftUIColor`; cross-dimension undo/redo in `applySnapshot` |
| `apple/DotorixelTests/EditorStateTests.swift` | 6 new tests — resize, cross-dimension undo, validation, same-dimension no-op, color selection, ColorPicker conversion |

### Key Decisions
- Resize uses top-left anchor by default; anchor selector UI deferred to a future task (UniFFI `ResizeAnchor` is ready)
- Cross-dimension undo/redo implemented in this issue rather than deferring — resize without undo would be a UX gap
- Two-step canvas restoration (`ApplePixelCanvas(width:height:)` + `restorePixels`) since `fromPixels` constructor doesn't exist in UniFFI; negligible overhead at pixel art scales

### Notes
- `DimensionField` is a private struct inside `RightPanel.swift` — extract if reuse is needed later
