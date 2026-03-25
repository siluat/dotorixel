# 028 — Foreground/background color swap

## Plan

### Context

The editor currently supports only a single foreground color. A background color slot and swap functionality are essential for the standard pixel art workflow. This task adds a second color slot (background color) and provides a UI button to swap the two colors.

### Scope

- Add background color state (default: white)
- Add swap method
- Add FG/BG preview + swap button to both UIs (Pixel, Pebble)
- Color picker/hex input always edits foreground color (workflow: swap → edit → swap to change background)
- X keyboard shortcut is in scope of a separate task ("Edit shortcuts") → excluded from this task

### Implementation steps

#### 1. Add background color state to EditorState

**File**: `src/lib/canvas/editor-state.svelte.ts`

- Add `backgroundColor = $state<Color>({ r: 255, g: 255, b: 255, a: 255 })`
- Add `selectedBackgroundColorHex = $derived(colorToHex(this.backgroundColor))`
- Add `backgroundColor?: Color` option to `EditorOptions`
- Add `swapColors` method:
  ```typescript
  swapColors = (): void => {
      const temp = this.foregroundColor;
      this.foregroundColor = this.backgroundColor;
      this.backgroundColor = temp;
  };
  ```

#### 2. Modify Pixel UI - ColorPalette

**File**: `src/lib/ui-pixel/ColorPalette.svelte`

- Add `backgroundColor`, `onSwapColors` to props
- Replace existing `.current-color` section with FG/BG overlapping swatches + swap button:
  - Foreground: top-left, 30×30px (displayed on top)
  - Background: bottom-right, 30×30px (displayed below, partially overlapping)
  - Swap button: small arrow icon at top-right corner
  - Keep hex label below (based on foreground color)
- Fit within approximately 50×50px area

#### 3. Modify Pebble UI - BottomColorPalette

**File**: `src/lib/ui-pebble/BottomColorPalette.svelte`

- Add `backgroundColor`, `onSwapColors` to props
- Replace existing large swatch with FG/BG overlapping swatches + swap button
- Style according to Pebble design language (rounded corners, warm tones)

#### 4. Page integration

**Files**: `src/routes/pixel/+page.svelte`, `src/routes/pebble/+page.svelte`

- Connect new props in each page:
  - `backgroundColor={editor.selectedBackgroundColorHex}`
  - `onSwapColors={editor.swapColors}`

#### 5. Update Storybook stories

**Files**: `src/lib/ui-pixel/ColorPalette.stories.svelte`, `src/lib/ui-pebble/BottomColorPalette.stories.svelte`

- Add `backgroundColor` prop to all stories (default `"#ffffff"`)
- Add `onSwapColors` callback (implement actual swap behavior in Interactive stories)

#### 6. Tests

**File**: `src/lib/canvas/editor-state.svelte.test.ts` (append to existing file)

- Test `swapColors` behavior: FG/BG swap correctly
- Verify default background color
- Test `EditorOptions.backgroundColor` custom initial value

### UI details

- **Swap button icon**: inline SVG bidirectional arrow (↔). Hand-written, no framework dependency
- **Accessibility**: swap button must have `aria-label="Swap foreground and background colors"`
- **Transparency pattern on swatches**: checkerboard pattern behind both FG and BG swatches so white or semi-transparent colors are distinguishable from the canvas background

### Verification

1. `bun run test` — all new + existing tests pass
2. `bun run dev` → `/pixel` page:
   - FG/BG overlapping swatches visible
   - Swap button click exchanges both colors
   - Color picker change + swap works correctly
3. `bun run dev` → `/pebble` page: same behavior verified
4. `bun run build` — production build succeeds
5. `bun run storybook` — stories render correctly

### Files to modify

| File | Change |
|------|--------|
| `src/lib/canvas/editor-state.svelte.ts` | backgroundColor state, swapColors method |
| `src/lib/ui-pixel/ColorPalette.svelte` | FG/BG overlapping swatches UI + swap button |
| `src/lib/ui-pebble/BottomColorPalette.svelte` | FG/BG overlapping swatches UI + swap button |
| `src/routes/pixel/+page.svelte` | Connect new props |
| `src/routes/pebble/+page.svelte` | Connect new props |
| `src/lib/ui-pixel/ColorPalette.stories.svelte` | Reflect new props |
| `src/lib/ui-pebble/BottomColorPalette.stories.svelte` | Reflect new props |
| `src/lib/canvas/editor-state.svelte.test.ts` | swapColors tests |

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-state.svelte.ts` | Added `backgroundColor` state, `selectedBackgroundColorHex` derived, `swapColors` method, `EditorOptions.backgroundColor` |
| `src/lib/ui-pixel/ColorPalette.svelte` | Replaced single preview box with FG/BG overlapping swatches + swap button, checkerboard transparency pattern |
| `src/lib/ui-pebble/BottomColorPalette.svelte` | Replaced single large swatch with FG/BG overlapping swatches + swap button, Pebble-styled (rounded, circular swap button) |
| `src/routes/pixel/+page.svelte` | Connected `backgroundColor` and `onSwapColors` props |
| `src/routes/pebble/+page.svelte` | Connected `backgroundColor` and `onSwapColors` props |
| `src/lib/ui-pixel/ColorPalette.stories.svelte` | Added `backgroundColor` to all stories, swap logic in Interactive story |
| `src/lib/ui-pebble/BottomColorPalette.stories.svelte` | Added `backgroundColor` to all stories, swap logic in Interactive story |
| `src/lib/canvas/editor-state.svelte.test.ts` | 4 new tests: swap, default bg, custom bg option, double-swap idempotency |
| `tasks/todo.md` | Added color picker trigger task to v0.1.0, added review backlog section |
