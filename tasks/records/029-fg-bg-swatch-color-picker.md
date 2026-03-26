# 029 — Trigger color picker from FG/BG color swatch

## Plan

### Context

Both Pixel and Pebble UI currently have a separate `picker-button` alongside the FG/BG preview. Users must click this separate button to open the color picker. This task changes the FG swatch itself to open the color picker on click, and removes the separate button.

### Files and Changes

#### 1. `src/lib/color-picker/FgBgPreview.svelte`

- Add `onForegroundClick?: () => void` callback prop
- Conditionally render FG swatch (`.swatch-fg`):
  - When `onForegroundClick` is provided: render as `<button>` element (`aria-label="Open color picker"`, `cursor: pointer`)
  - When `onForegroundClick` is absent: keep existing `<div>`
- Browser default style reset needed for `<button>`: `background-color: transparent; padding: 0; font: inherit;`
  - Must use `background-color: transparent` only so `.checkerboard`'s `background-image` is preserved (`background: none` would clear the image layer too)
- Swap button is a sibling element (z-index: 2), so no click conflict with FG swatch

#### 2. `src/lib/ui-pixel/ColorPalette.svelte`

- Move `anchorEl` binding to `.current-color` wrapper
- Pass `onForegroundClick={() => (isPickerOpen = !isPickerOpen)}` to FgBgPreview
- Move picker popup inside `.current-color`, add `position: relative` to `.current-color`
- Popup position: `top: calc(100% + 4px); left: 0;` (opens below FgBgPreview)
- Remove picker-button and picker-anchor from `.color-input` row (keep only hex text field)
- Remove now-unused `.picker-button`, `.picker-anchor` styles

#### 3. `src/lib/ui-pebble/BottomColorPalette.svelte`

- Move `anchorEl` binding to `.fg-bg-wrapper`
- Pass `onForegroundClick={() => (isPickerOpen = !isPickerOpen)}` to FgBgPreview
- Move picker popup inside `.fg-bg-wrapper`
- Popup position: `bottom: calc(100% + 8px); left: 0;` (opens above FgBgPreview)
- Remove separate picker-button and the separator before it
- Remove now-unused `.picker-button`, `.picker-anchor` styles

#### Story files (no changes needed)

- `FgBgPreview.stories.svelte`: `onForegroundClick` is optional, so existing stories work as-is
- `ColorPalette.stories.svelte`, `BottomColorPalette.stories.svelte`: color picker trigger changes but API (props) remains the same, so no changes needed

### Verification

- `bun run check` — confirm no type errors
- `bun run dev` — in both Pixel UI and Pebble UI:
  - FG swatch click opens color picker
  - Color change works in the picker
  - Outside click closes the picker
  - Swap button works correctly (does not open picker)
  - Separate picker-button is gone
  - Hex field (Pixel UI) works correctly

## Results

| File | Description |
|------|-------------|
| `src/lib/color-picker/FgBgPreview.svelte` | Added `onForegroundClick` and `onBackgroundClick` optional props; conditionally render FG/BG swatches as `<button>` with browser default style reset |
| `src/lib/canvas/editor-state.svelte.ts` | Added `handleBackgroundColorChange` method; renamed `handleColorChange` → `handleForegroundColorChange` |
| `src/lib/ui-pixel/ColorPalette.svelte` | Replaced `isPickerOpen` with `pickerTarget: 'fg' \| 'bg' \| null`; moved picker popup to `.current-color`; removed picker-button/picker-anchor; renamed prop `onColorChange` → `onForegroundColorChange`; added `onBackgroundColorChange` prop |
| `src/lib/ui-pebble/BottomColorPalette.svelte` | Same pattern as ColorPalette; removed picker-button and its separator; renamed prop `onColorChange` → `onForegroundColorChange`; added `onBackgroundColorChange` prop |
| `src/routes/pixel/+page.svelte` | Updated prop names to match renamed palette API |
| `src/routes/pebble/+page.svelte` | Updated prop names to match renamed palette API |
| `src/lib/ui-pixel/ColorPalette.stories.svelte` | Updated prop name to `onForegroundColorChange` |
| `src/lib/ui-pebble/BottomColorPalette.stories.svelte` | Updated prop name to `onForegroundColorChange` |

### Key Decisions
- Extended scope beyond the original plan: added BG swatch click support and renamed `onColorChange` → `onForegroundColorChange` for naming symmetry with the new `onBackgroundColorChange`.
- Used `PickerTarget = 'fg' | 'bg'` union with `null` instead of two separate booleans to prevent impossible states (both pickers open simultaneously).
- `ColorPickerPopup` and `HsvPicker` kept their generic `onColorChange` prop name — these are context-agnostic color picker components.
- Used `onBackgroundColorChange ?? onForegroundColorChange` fallback instead of non-null assertion (`!`) for type safety.
