# 059 — Move tool (drag to reposition canvas content)

## Plan

Add a Move tool that repositions canvas content by dragging. An M2 core tool with no dependencies on other tools. Uses the same snapshot-restore preview pattern as shape tools, but translates existing pixels instead of drawing new ones.

### 1. `shiftPixels` pure function (new file)

**File:** `src/lib/canvas/shift-pixels.ts`

- `shiftPixels(source: Uint8Array, width: number, height: number, dx: number, dy: number): Uint8Array`
- Allocate new transparent buffer, row-by-row bulk copy with clipping
- Same algorithm as Rust `resize_with_anchor` but for same-size canvas with (dx, dy) offset
- Max canvas size 256×256 (~1MB), TypeScript is sufficient

**Tests:** `src/lib/canvas/shift-pixels.test.ts`
- Zero offset → output equals input
- Positive/negative direction movement
- Complete off-canvas movement → fully transparent
- Partial row clipping

### 2. ToolType extension

**File:** `src/lib/canvas/tool-types.ts`

- Add `'move'` → TypeScript detects unhandled branches

### 3. i18n messages

**Files:** `messages/en.json`, `messages/ko.json`, `messages/ja.json`

- `"tool_move"`: "Move" / "이동" / "移動"
- Place after `tool_eyedropper`

### 4. EditorState core logic

**File:** `src/lib/canvas/editor-state.svelte.ts`

**New fields:**
- `#moveStart: CanvasCoords | null = null`
- `#moveSnapshot: Uint8Array | null = null`

**handleDrawStart:**
- Not skipped like eyedropper (needs undo snapshot since it modifies pixels)
- Exclude from `recentColors` update (add `'move'` to existing `eraser` exclusion)
- Capture preview snapshot: `this.#moveSnapshot = new Uint8Array(this.pixelCanvas.pixels())`

**handleDraw:**
- If `previous === null`: record `#moveStart` and return
- Otherwise: restore snapshot → `shiftPixels(snapshot, w, h, current.x - moveStart.x, current.y - moveStart.y)` → `restore_pixels` → `renderVersion++`
- Place between shape tool branch and eyedropper/floodfill branch

**handleDrawEnd:**
- Reset `#moveStart = null`, `#moveSnapshot = null`

**Keyboard shortcut:**
- Add `KeyM: 'move'` to `TOOL_SHORTCUTS`

### 5. Update 5 toolbar components

Add `Move` icon (`lucide-svelte`) import + move button after eyedropper in all components:

| Component | Position |
|-----------|----------|
| `src/lib/ui-pixel/Toolbar.svelte` | Between eyedropper and separator |
| `src/lib/ui-editor/LeftToolbar.svelte` | End of tools array |
| `src/lib/ui-editor/ToolStrip.svelte` | End of tools array |
| `src/lib/ui-editor/BottomToolsPanel.svelte` | Between eyedropper and separator |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Between eyedropper and separator |

### 6. Add tests

**File:** `src/lib/canvas/editor-state.svelte.test.ts`

- Add `drawMove` helper function (follows existing `drawLine` pattern)
- Test cases: content repositioning, clipping, transparent fill, undo restoration, no recentColors update
- Add `['KeyM', 'move']` to TOOL_SHORTCUTS test

### 7. Storybook stories

Add `activeTool="move"` story to each toolbar component's story file.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/shift-pixels.ts` | Pure function: row-by-row bulk copy with clipping for pixel translation |
| `src/lib/canvas/shift-pixels.test.ts` | 8 unit tests covering zero offset, directional shifts, clipping, immutability |
| `src/lib/canvas/tool-types.ts` | Added `'move'` to `ToolType` union |
| `messages/en.json` | Added `tool_move`: "Move" |
| `messages/ko.json` | Added `tool_move`: "이동" |
| `messages/ja.json` | Added `tool_move`: "移動" |
| `src/lib/canvas/editor-state.svelte.ts` | Move tool core logic: snapshot-restore preview, `shiftPixels` integration, `KeyM` shortcut |
| `src/lib/canvas/editor-state.svelte.test.ts` | 6 move tool tests + shortcut mapping update |
| `src/lib/ui-pixel/Toolbar.svelte` | Move button with `Move` icon after eyedropper |
| `src/lib/ui-pixel/StatusBar.svelte` | Added `move` to `TOOL_MESSAGE` record |
| `src/lib/ui-editor/LeftToolbar.svelte` | Move entry in tools array |
| `src/lib/ui-editor/ToolStrip.svelte` | Move entry in tools array, updated layout comment |
| `src/lib/ui-editor/BottomToolsPanel.svelte` | Move button after eyedropper |
| `src/lib/ui-editor/StatusBar.svelte` | Added `move` to `toolMessages` record |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Move button after eyedropper |
| `src/lib/ui-pixel/Toolbar.stories.svelte` | MoveActive story |
| `src/lib/ui-editor/LeftToolbar.stories.svelte` | MoveActive story |
| `src/lib/ui-editor/BottomToolsPanel.stories.svelte` | MoveSelected story |
| `src/lib/ui-pebble/BottomToolsPanel.stories.svelte` | MoveSelected story |
| `tasks/todo.md` | Moved "Tool-specific mouse cursor" from Review backlog to M2 |

### Key Decisions
- TypeScript-only pixel shifting (no WASM) — max canvas 256×256 (~1MB), JS row-by-row copy is sufficient
- Inline move state in EditorState rather than creating a MoveHandler class — single tool, no variants to abstract over
- Cursor change deferred — existing backlog item "Tool-specific mouse cursor" moved to M2 for consistent treatment of all tools

### Notes
- Two `StatusBar.svelte` components (pixel UI, editor UI) had `Record<ToolType, ...>` maps that required updating — missed during initial implementation, caught via manual testing. `svelte-check` would have detected this at compile time.
- ToolStrip layout: 9 buttons × 44px = 396px may overflow on 360px viewports (iPhone SE). Acceptable for MVP since most devices are 375px+.
