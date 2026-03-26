# 032 — Modifier key: Space=pan (temporary pan mode)

## Plan

### Context

Space+Pan functionality was already implemented as local state in `PixelCanvasView.svelte`, but unlike the Alt eyedropper pattern, it was not integrated into EditorState. This caused issues: missing blur handling, inadequate Space prevention during drawing, and no tests. Integrate into EditorState using the same pattern as Alt eyedropper to ensure consistency, robustness, and testability.

### Key Design Decision

**Pan is not a ToolType.** Pan is a viewport interaction, so it does not change `activeTool`. The Alt eyedropper's `#toolBeforeModifier`/restore mechanism is unnecessary. EditorState manages only a `#isSpaceHeld` boolean, and PixelCanvasView reads it as a prop to determine panning trigger and cursor.

### Implementation Steps

1. **EditorState: Add Space key state** (`src/lib/canvas/editor-state.svelte.ts`)
   - `#isSpaceHeld = $state(false)` private field (below `#isAltHeld`)
   - `get isSpaceHeld(): boolean` public getter

2. **handleKeyDown: Add Space handling**
   - Place after Alt block, before Ctrl+Z block
   - `event.preventDefault()` called first — prevents browser scroll even on OS key repeat
   - `event.repeat` ignored (no state change needed)
   - `#isDrawing` check — ignore Space during drawing

3. **handleKeyUp: Add Space handling**
   - Simple reset: `this.#isSpaceHeld = false`

4. **handleBlur: Add Space reset**
   - `this.#isSpaceHeld = false` below `this.#isAltHeld = false`

5. **PixelCanvasView: Remove local Space state** (`src/lib/canvas/PixelCanvasView.svelte`)
   - Remove: `let isSpaceHeld = $state(false)`, `handleKeyDown`, `handleKeyUp`, `isSpaceHeld = false` in `handleWindowBlur`, `onkeydown`/`onkeyup` on `<svelte:window>`, `isInteractiveTarget` function
   - Add: `isSpaceHeld?: boolean` prop with default `false`
   - Keep: `cursorStyle` derived and `handlePointerDown` references (same name)

6. **Page routes: Pass isSpaceHeld**
   - `src/routes/pebble/+page.svelte`: `isSpaceHeld={editor.isSpaceHeld}`
   - `src/routes/pixel/+page.svelte`: same

7. **Tests** (`src/lib/canvas/editor-state.svelte.test.ts`)
   - Space press sets `isSpaceHeld` true
   - Space release resets to false
   - `event.repeat` ignored
   - Drawing blocks Space
   - Window blur resets
   - Tool shortcuts work after Space release

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-state.svelte.ts` | Added `#isSpaceHeld` field, public getter, Space handling in handleKeyDown/KeyUp/Blur |
| `src/lib/canvas/PixelCanvasView.svelte` | Removed local Space state, keyboard handlers, duplicate `isInteractiveTarget`; added `isSpaceHeld` prop |
| `src/routes/pebble/+page.svelte` | Pass `isSpaceHeld={editor.isSpaceHeld}` prop |
| `src/routes/pixel/+page.svelte` | Pass `isSpaceHeld={editor.isSpaceHeld}` prop |
| `src/lib/canvas/editor-state.svelte.test.ts` | Added 6 tests for Space pan mode |
