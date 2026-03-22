# 007 — Pebble UI design exploration

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-state.svelte.ts` | Shared `EditorState` class — Svelte 5 runes-based reactive state + handlers |
| `src/lib/ui-pebble/pebble-tokens.css` | Design tokens scoped to `.pebble-editor` (`--pebble-*` prefix) |
| `src/lib/ui-pebble/pebble-palette-data.ts` | 2×9 preset color palette data |
| `src/lib/ui-pebble/FloatingPanel.svelte` | Pill-shaped translucent panel wrapper with `style` prop |
| `src/lib/ui-pebble/PebbleButton.svelte` | Icon button — acorn brown accent on active state |
| `src/lib/ui-pebble/PebbleSwatch.svelte` | Color swatch — hover scale, selected outline |
| `src/lib/ui-pebble/TopControlsLeft.svelte` | Undo/Redo/Grid toggle (absolute top-left) |
| `src/lib/ui-pebble/TopControlsRight.svelte` | Canvas presets, W×H input, Export, Clear (absolute top-right) |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Pen/Eraser toggle + zoom controls (bottom center) |
| `src/lib/ui-pebble/BottomColorPalette.svelte` | Active swatch + preset grid + custom picker (bottom center) |
| `src/lib/ui-pebble/*.stories.svelte` | Co-located Svelte CSF v5 stories for all 7 components |
| `src/routes/pebble/+page.svelte` | Full editor page — full-screen canvas with floating overlay UI |
| `.storybook/preview.ts` | Added `pebble-tokens.css` import for Storybook |

### Key Decisions

- Acorn brown accent (`oklch(0.55 0.15 45)`) reused from existing primary color for brand consistency
- `EditorState` class extracted to eliminate duplicated state/handler logic between pages
- Full-screen canvas with `ResizeObserver`-driven viewport sizing (Figma-like infinite canvas pattern)
- Originally named "Blossom", renamed to "Pebble" to match the rounded panel shapes + warm earth tones

### Notes

- Existing `/` page is untouched — `EditorState` can be adopted there later
- Canvas resize preserves viewport position (`clamp_pan`) instead of resetting (`for_canvas`)
