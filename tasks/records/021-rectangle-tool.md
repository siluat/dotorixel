# 021 — Rectangle Tool

## Plan

Reuse the two-point drag + snapshot-restore preview pattern established by the Line tool to implement the Rectangle tool.

### 1. Rust core — algorithm and type

- Add `Rectangle` variant to `ToolType` enum; extend `apply()` match arm.
- Add `pub fn rectangle_outline(x0, y0, x1, y1) -> Vec<(i32, i32)>`:
  - Normalize coordinates (min/max).
  - Generate 4 edges without corner duplication: top/bottom span full width, left/right span interior only.
  - Handle degenerate cases: single point, 1-pixel height, 1-pixel width.
- Tests: single point, horizontal line, vertical line, 3×3 outline, no duplicates, reverse coordinates.

### 2. WASM bindings

- Add `WasmToolType::Rectangle = 3` with `to_core()` mapping.
- Add `wasm_rectangle_outline()` returning flat `[x, y, ...]` array.

### 3. TypeScript type

- Add `'rectangle'` to `ToolType` union in `tool-types.ts`.

### 4. EditorState — interaction logic

- Import `wasm_rectangle_outline`; add `rectangle` to `WASM_TOOL_MAP`.
- Extend `handleDrawStart()` conditions: snapshot saving and recentColors update.
- Add `#handleRectangleDraw()` method (same snapshot-restore structure as `#handleLineDraw`).
- Route `handleDraw()` to `#handleRectangleDraw` when `activeTool === 'rectangle'`.
- Rename `#lineStart` → `#shapeStart` (shared by Line and Rectangle).

### 5. UI components

- Both Pebble (`BottomToolsPanel`) and Pixel (`Toolbar`, `StatusBar`) themes: add Rectangle button with `Square` icon from lucide-svelte.

### 6. Storybook

- Add `RectangleSelected` story to `BottomToolsPanel.stories.svelte`.
- Add `RectangleActive` story to `Toolbar.stories.svelte`.

### 7. TypeScript tests

- Add `drawRectangle` helper.
- Test cases: outline correctness, no preview artifacts (snapshot-restore), undo atomicity, recentColors update.

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
