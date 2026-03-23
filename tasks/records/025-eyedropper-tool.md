# 025 — Eyedropper tool

## Plan

Add an eyedropper tool that reads a pixel's color from the canvas and sets it as the foreground color. Unlike existing tools (all write to canvas), eyedropper is read-only — no WASM tool operation needed, uses existing `WasmPixelCanvas.get_pixel()`.

1. Add `'eyedropper'` to ToolType union
2. Guard `handleDrawStart()` to skip undo snapshot for eyedropper
3. Add eyedropper branch in `handleDraw()` — read pixel, set foregroundColor, update recentColors
4. Skip transparent pixels (a === 0) to avoid hex/RGBA mismatch
5. Add Pipette icon button to both Pixel and Pebble toolbars
6. Add TOOL_LABELS entry for StatusBar
7. Write tests: color pick, transparent ignore, no undo snapshot, recentColors update

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/tool-types.ts` | Added `'eyedropper'` to ToolType union |
| `src/lib/canvas/editor-state.svelte.ts` | handleDrawStart early return for eyedropper; handleDraw eyedropper branch |
| `src/lib/ui-pixel/Toolbar.svelte` | Pipette icon button after flood fill |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Pipette icon button after flood fill |
| `src/lib/ui-pixel/StatusBar.svelte` | `eyedropper: 'Eyedropper'` in TOOL_LABELS |
| `src/lib/canvas/editor-state.svelte.test.ts` | 4 tests: pick color, transparent ignore, no undo snapshot, recentColors |

### Key Decisions

- Transparent pixel clicks are ignored rather than setting foregroundColor to `#000000`. The current color system only supports 6-digit hex (no alpha), so picking RGBA(0,0,0,0) would display as `#000000` but behave like an eraser — confusing.
- recentColors is updated in `handleDraw()` (not `handleDrawStart()`) because the picked color is determined by the canvas pixel, not the pre-selected foreground color.
