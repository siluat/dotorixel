# 024 — Flood Fill Tool

## Plan

Implement BFS-based flood fill algorithm in Rust core and connect it to the web editor via WASM bindings.

- 4-connectivity (up, down, left, right only)
- No-op when clicking a pixel that already has the fill color
- Modify pixels directly in Rust core (instead of returning coordinate lists)
- Single-click tool (no drag)
- Standalone function instead of adding to `ToolType` enum

## Results

| File | Description |
|------|-------------|
| `crates/core/src/tool.rs` | `flood_fill()` BFS function + 8 tests |
| `wasm/src/lib.rs` | `wasm_flood_fill()` WASM binding |
| `src/lib/canvas/tool-types.ts` | Added `'floodfill'` type |
| `src/lib/canvas/editor-state.svelte.ts` | Flood fill handling (import, recent color, handleDraw branch) |
| `src/lib/ui-pixel/Toolbar.svelte` | Flood Fill button (PaintBucket icon) |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Pebble UI Flood Fill button |
| `src/lib/ui-pixel/StatusBar.svelte` | Added `floodfill` entry to `TOOL_LABELS` |
| `tasks/todo.md` | Removed flood fill item, added Tool Handler refactoring task |

### Key Decisions

- Standalone function `flood_fill(canvas, x, y, color)` — `ToolType::apply()` has a single-pixel interface that doesn't fit area-fill semantics
- `Vec<bool>` visited array — max 128x128 = 16KB, small enough to avoid HashSet overhead

### Notes

- Registered follow-up refactoring task: Tool Handler strategy pattern — extract per-tool branching in EditorState.handleDraw() into a ToolHandler interface
- handleDrawStart unconditionally saves an undo snapshot, causing unnecessary snapshots when clicking the same color (consistent with existing tool behavior)
