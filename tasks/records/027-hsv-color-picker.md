# 027 — HSV color picker

## Plan

### Context

Both UI variants (Pebble, Pixel) use native `<input type="color">`. The native picker looks different per OS and opens as a separate system dialog that cannot be styled or embedded inline. Replace with an Aseprite-style SV square + H strip combination for cross-platform visual consistency and inline UI integration.

### Implementation Steps

#### Step 1: HSV conversion utilities (modify `src/lib/canvas/color.ts`)

Add `HsvColor` interface and pure conversion functions:

```typescript
export interface HsvColor {
  readonly h: number; // 0-360 (degrees)
  readonly s: number; // 0-1
  readonly v: number; // 0-1
}

export function rgbToHsv(color: Color): HsvColor { ... }
export function hsvToRgb(hsv: HsvColor): Color { ... } // a: 255 fixed
```

#### Step 2: HSV conversion tests (modify `src/lib/canvas/color.test.ts`)

- Known color pairs: red, green, blue, cyan, magenta, yellow
- Achromatic: black, white, gray (hue=0 convention)
- Round-trip test: `hsvToRgb(rgbToHsv(color))` === original color
- Boundary values, integer rounding tolerance

#### Step 3: HSV picker component (new `src/lib/color-picker/` directory)

**`HsvPicker.svelte`** — Canvas2D-based core component:

- **SV square**: horizontal white→pure hue gradient + vertical transparent→black overlay. Crosshair indicator.
- **H strip**: vertical rainbow strip. Horizontal indicator.
- Props: `hex`, `onColorChange(hex)`, `width?`, `height?`
- Internal `$state` for `{ h, s, v }`. Syncs on external hex change, preserving hue when achromatic (S=0, V=0).
- `setPointerCapture` for drag handling. SV canvas re-renders only when H changes.

**`HsvPicker.stories.svelte`** — Default, red selected, gray selected stories

#### Step 4: Popup wrapper (new `src/lib/color-picker/ColorPickerPopup.svelte`)

- HsvPicker + hex text input combination
- Close on outside click / Escape
- Props: `hex`, `onColorChange(hex)`, `onClose()`
- Minimal layout only. Visual styling applied by each UI variant.

#### Step 5: Pebble UI integration (modify `src/lib/ui-pebble/BottomColorPalette.svelte`)

- `<input type="color">` → toggle HSV popup on current color swatch click
- Add `$state` `isPickerOpen`
- Popup position: above bottom bar (`bottom: 100%`)
- Pebble token styling (rounded corners, shadow)

#### Step 6: Pixel UI integration (modify `src/lib/ui-pixel/ColorPalette.svelte`)

- Native picker → swatch button + HSV popup
- Keep existing hex text input (independent from popup hex input)
- Pixel token styling (3D bevel)

#### Step 7: Story updates

- `BottomColorPalette.stories.svelte` — add picker-open state story
- `ColorPalette.stories.svelte` — add picker-open state story (if applicable)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/color.ts` | `HsvColor` interface, `rgbToHsv()`, `hsvToRgb()` |
| `src/lib/canvas/color.test.ts` | 24 HSV conversion tests (primaries, achromatic, round-trip) |
| `src/lib/color-picker/HsvPicker.svelte` | SV square + H strip Canvas2D picker component |
| `src/lib/color-picker/HsvPicker.stories.svelte` | Default, RedSelected, GraySelected stories |
| `src/lib/color-picker/ColorPickerPopup.svelte` | Popup wrapper with hex input and Escape handling |
| `src/lib/ui-pebble/BottomColorPalette.svelte` | Replaced native picker with HSV popup, Pebble tokens |
| `src/lib/ui-pebble/BottomColorPalette.stories.svelte` | Added Interactive story, fixed TS type |
| `src/lib/ui-pixel/ColorPalette.svelte` | Replaced native picker with HSV popup, Pixel tokens |

### Key Decisions

- Popup outside-click detection lives in parent components (not in `ColorPickerPopup`). The parent owns both the trigger button and the popup, so `anchorEl.contains(target)` naturally prevents the toggle race condition where `pointerdown` closes and `click` reopens.
- `ColorPickerPopup` exposes CSS custom properties (`--picker-input-border`, `--picker-ring`, `--picker-error`, `--picker-input-bg`) instead of hardcoding visual values. Each UI variant overrides these with its own design tokens.
- Prop name `selectedColor` used consistently across both picker and palette components.

### Notes

- Achromatic hue preservation: when the external color has S=0 or V=0, the picker retains the previous hue internally so dragging saturation back up restores the original hue.
- The hue strip canvas renders once on mount (static rainbow gradient). The SV canvas re-renders only when hue changes.
