# 025 — Eyedropper tool

## Plan

Add an eyedropper tool that reads a pixel's color from the canvas and sets it as the foreground color. Read-only tool — no WASM tool operation needed, uses existing `WasmPixelCanvas.get_pixel()`. Transparent pixels ignored to avoid hex/RGBA mismatch.

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
