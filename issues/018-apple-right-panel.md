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

- [ ] RightPanel displays Canvas section and Color section separated by a divider
- [ ] Canvas size presets update canvas dimensions on tap
- [ ] Width/height text inputs commit on blur or Return
- [ ] Clear button is visible but disabled
- [ ] Foreground swatch shows the current drawing color
- [ ] Palette grid colors are selectable and update the foreground color
- [ ] SwiftUI ColorPicker updates the foreground color
- [ ] Panel scrolls if content overflows vertically

## Blocked by

- [015 — Design tokens + layout skeleton](015-apple-layout-skeleton.md)

## Scenarios addressed

- Scenario 5: User adjusts canvas size via presets or text input → canvas resizes
- Scenario 6: User picks a color from palette or ColorPicker → foreground color updates

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Views/RightPanel.swift` | Replaced placeholder with full implementation: `ScrollView` + `VStack` containing Canvas section (preset row, width/height inputs, disabled Clear button) and Color section (foreground swatch, palette grid, SwiftUI `ColorPicker`), separated by a divider. Computed-property sub-views mirror `TopBar.swift`. Bridges UniFFI `Color` ↔ `SwiftUI.Color` via `foregroundBinding` so `ColorPicker` can drive `editorState.foregroundColor` directly. |
| `apple/Dotorixel/State/EditorState.swift` | Added `resizeCanvas(width:height:)`: silent no-op for unchanged or out-of-range dimensions, swaps in the resized `ApplePixelCanvas`, reclamps the viewport against the new bounds, bumps `canvasVersion` to trigger re-render. Removed legacy "matches Pebble's #2D2D2D" comment from default foreground initialization. |
| `apple/DotorixelTests/EditorStateTests.swift` | New Swift Testing suite with 4 tests covering `resizeCanvas`: dimension update, `canvasVersion` bump, same-dimensions no-op, invalid-dimensions rejection (zero / above `canvasMaxDimension()`). |
| `apple/Dotorixel/Data/DefaultPalette.swift` | Renamed `enum PebblePalette` → `enum DefaultPalette`. Added `static var columnCount: Int { rows[0].count }` so the palette grid in `RightPanel` derives column count from the data instead of hard-coding `9`. Removed dead reference to a no-longer-existing `pebble-palette-data.ts`. |
| `apple/Dotorixel/Rendering/PixelCanvasView.swift` | Cleaned up the default grid color comment to drop the dead `--pebble-canvas-stroke` reference; now reads `Default grid line color — light warm gray (#E0DCD7).` |

### Key Decisions

- **Resize clears history.** `applySnapshot` rejects cross-dimension restores (`assertionFailure` in debug, silent no-op in release), so leaving pre-resize snapshots on the stack would surface as `canUndo == true` while the actual restore silently fails — a user-visible regression where the Undo button appears active but does nothing. `resizeCanvas` therefore calls `historyManager.clear()` (and bumps `historyVersion`) on every successful resize. Resize itself stays non-undoable on Apple until cross-dimension undo is implemented; this is a known divergence from web (`tasks/todo.md` Apple Phase 1 area can absorb a follow-up).
- **Direct foreground color assignment.** Palette swatches use `editorState.foregroundColor = color` directly rather than introducing a wrapper method — minimal abstraction matches the simplicity of the action.
- **Extract `controlHeight`.** The 28pt control height appeared in 4 places (preset buttons, size inputs, Clear button, foreground swatch). Extracted to a single private constant per CLAUDE.md "make values self-documenting" / shared-constant rule.
- **`DefaultPalette.columnCount`.** Replaced magic `9` in `LazyVGrid` columns with a derived `columnCount`, so structural changes to palette layout flow through one source of truth.
- **Pebble naming cleanup scoped to Apple.** Renamed `PebblePalette` → `DefaultPalette` (Apple-only file, no cross-shell references) and removed dead web-side comments referencing files/tokens that no longer exist (`pebble-palette-data.ts`, `--pebble-canvas-stroke`). Web-side `Pebble UI theme` row in `docs/platform-status.md` and any remaining web identifiers are out of scope for this task — they describe a real (deprecated) UI theme history and need a separate, web-aware cleanup.

### Notes

- All 19 Apple unit tests pass (15 existing + 4 new in `EditorStateTests`).
- SwiftUI view tests were not added: the Apple shell currently has no view-test infrastructure (only `DesignTokensTests.swift`). Introducing ViewInspector / XCUITest is a meta-decision and out of scope for #018; TDD was scoped to the `EditorState` mutator the panel calls into.
- All 8 acceptance criteria manually verified by the user on macOS in the running app. iPadOS smoke test is pending reviewer follow-up.
