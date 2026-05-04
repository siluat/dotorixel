# Progress

## Currently Working On

Apple native: layout transition from floating panels to docked layout ([PRD](../issues/014-apple-native-docked-layout.md))

## Last Completed

[018 — Apple native: RightPanel](../issues/018-apple-right-panel.md): replaced the placeholder with a full RightPanel implementation — Canvas section (preset row, width/height text inputs that commit on blur/Return, disabled Clear button) and Color section (foreground swatch, 2×9 palette grid, SwiftUI `ColorPicker`) separated by a divider, wrapped in a vertical `ScrollView`. Added `EditorState.resizeCanvas(width:height:)` (silent no-op for unchanged or out-of-range dimensions, swaps in resized `ApplePixelCanvas`, reclamps viewport, bumps `canvasVersion`); no history snapshot pushed because `applySnapshot` rejects cross-dimension restores — resize stays non-undoable on Apple until that gap is addressed. Bridged UniFFI `Color` ↔ `SwiftUI.Color` via `foregroundBinding` so `ColorPicker` drives `editorState.foregroundColor` directly. Apple-side Pebble naming residue cleaned up: renamed `enum PebblePalette` → `enum DefaultPalette` with derived `columnCount`; dropped dead web-side comments (`pebble-palette-data.ts`, `--pebble-canvas-stroke`) from migrated files. 4 new tests on `EditorState` mutator (dimension update, `canvasVersion` bump, same-dimensions no-op, invalid-dimensions rejection); 19 Apple tests passing. SwiftUI view tests deferred — Apple shell has no view-test infrastructure yet, so introducing ViewInspector/XCUITest is a separate meta-decision.

## Next Up

- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Sibling of 018 under [PRD 014](../issues/014-apple-native-docked-layout.md). Independent, can start immediately and completes the docked layout PRD.
- Layer system: basic infrastructure (add/delete/reorder)
  - Milestone 3 next major feature. Needs a PRD before implementation.
