# 062 — Move tool mouse cursor

## Plan

### Context

The `toolCursor` prop infrastructure already exists in `PixelCanvasView` but is not wired up. All tools currently use the default `'crosshair'` cursor. Apply the `'move'` cursor to the move tool to visually communicate that canvas content can be dragged to reposition.

### Steps

1. Add `TOOL_CURSORS` mapping in `src/lib/canvas/tool-types.ts`
   - `Record<ToolType, string>` — `move: 'move'`, all others: `'crosshair'`
2. Add `toolCursor` derived property in `src/lib/canvas/editor-state.svelte.ts`
   - `readonly toolCursor = $derived(TOOL_CURSORS[this.activeTool])`
3. Pass `toolCursor` prop to all 4 `PixelCanvasView` instances across 3 route files
   - `src/routes/editor/+page.svelte` (2 instances)
   - `src/routes/pixel/+page.svelte` (1 instance)
   - `src/routes/pebble/+page.svelte` (1 instance)
4. Add tests in `src/lib/canvas/editor-state.svelte.test.ts`
   - Default cursor is `'crosshair'`
   - Move tool cursor is `'move'`
   - All tool types have a cursor mapping

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/tool-types.ts` | Added `TOOL_CURSORS` mapping (`move: 'move'`, all others: `'crosshair'`) |
| `src/lib/canvas/editor-state.svelte.ts` | Added `toolCursor` derived property, updated import |
| `src/routes/editor/+page.svelte` | Wired `toolCursor` prop to 2 PixelCanvasView instances |
| `src/routes/pebble/+page.svelte` | Wired `toolCursor` prop to PixelCanvasView |
| `src/routes/pixel/+page.svelte` | Wired `toolCursor` prop to PixelCanvasView |
| `src/lib/canvas/editor-state.svelte.test.ts` | Added 3 tests for toolCursor behavior and completeness |

