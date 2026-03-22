# 021 — Rectangle Tool

## Results

| File | Description |
|------|-------------|
| `crates/core/src/tool.rs` | `ToolType::Rectangle` variant, `rectangle_outline()` algorithm, tests |
| `wasm/src/lib.rs` | `WasmToolType::Rectangle`, `wasm_rectangle_outline()` binding |
| `src/lib/canvas/tool-types.ts` | `'rectangle'` added to `ToolType` union |
| `src/lib/canvas/editor-state.svelte.ts` | `#handleRectangleDraw`, snapshot-restore preview, `#lineStart` → `#shapeStart` rename |
| `src/lib/canvas/editor-state.svelte.test.ts` | Rectangle tool tests (outline, preview artifacts, undo, recentColors) |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Rectangle button (Square icon) |
| `src/lib/ui-pixel/Toolbar.svelte` | Rectangle button |
| `src/lib/ui-pixel/StatusBar.svelte` | `rectangle: 'Rectangle'` label |
| `src/lib/ui-pebble/BottomToolsPanel.stories.svelte` | `RectangleSelected` story |
| `src/lib/ui-pixel/Toolbar.stories.svelte` | `RectangleActive` story |

### Key Decisions

- `#lineStart` → `#shapeStart` rename: Line and Rectangle share the same two-point drag field. Generalizes for future shape tools.
- Separate `#handleRectangleDraw` method instead of shared abstraction: only 2 shape tools so far; extract when a 3rd is added.

### Notes

- Rectangle outline algorithm deduplicates corner pixels by assigning top/bottom edges full width and left/right edges interior-only range.
