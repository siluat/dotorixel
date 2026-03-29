# 039 — Number input mobile optimization

## Plan

Add `inputmode="numeric"` attribute to all 4 canvas dimension `<input type="number">` elements to show a numeric keypad on mobile virtual keyboards.

### Files to modify

1. `src/lib/ui-pixel/CanvasSettings.svelte` — width input (line 73), height input (line 88)
2. `src/lib/ui-pebble/TopControlsRight.svelte` — width input (line 63), height input (line 74)

### Why `inputmode="numeric"`

- `inputmode="decimal"` includes a decimal point key — canvas dimensions are integers only
- `inputmode="numeric"` shows a number pad, works alongside `type="number"` min/max validation
- `type="number"` alone does not guarantee a numeric keyboard on all mobile browsers

### Verification

1. `bun run check` — no type errors
2. `bun run build` — production build succeeds
3. Mobile device or Chrome DevTools mobile emulation — numeric keypad appears on input tap

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-pixel/CanvasSettings.svelte` | Added `inputmode="numeric"` to width and height inputs |
| `src/lib/ui-pebble/TopControlsRight.svelte` | Added `inputmode="numeric"` to width and height inputs |
