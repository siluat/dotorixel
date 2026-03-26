# 031 — Alt key temporary eyedropper tool switch

## Plan

### Context

The eyedropper tool (I key) only supports permanent switching. In pixel art editors, holding Alt to temporarily switch to the eyedropper and returning to the previous tool on Alt release is a standard workflow. Most pixel editors like Aseprite and Piskel support this pattern.

### Core Edge Case: Alt Release During Drawing

`handleDrawStart` does not push an undo snapshot when the active tool is eyedropper (line 129). If Alt is released during drawing, the tool changes to pencil, and subsequent mouse movement could cause a pencil stroke without a snapshot → non-undoable change.

**Solution**: Track `#isAltHeld` state using the same pattern as PixelCanvasView's `isSpaceHeld`. Defer tool restoration during drawing and handle it in `handleDrawEnd`.

### Implementation

1. **EditorState state fields**: Add `#toolBeforeModifier` and `#isAltHeld` private state fields.
2. **handleKeyDown Alt detection**: Before the existing `event.altKey` guard, detect standalone Alt key press. Switch to eyedropper unless drawing or already using eyedropper.
3. **handleKeyUp method**: Restore previous tool on Alt release, unless currently drawing (deferred to drawEnd).
4. **handleDrawEnd deferred restore**: Restore tool if `#toolBeforeModifier` is set and Alt is no longer held.
5. **handleBlur method**: Restore tool on window focus loss (Alt keyup event may not fire).
6. **Page event wiring**: Add `onkeyup` and `onblur` to `<svelte:window>` in both pixel and pebble pages.
7. **Tests**: 8 test cases covering normal flow, edge cases (drawing, repeat, blur), and AltRight support.

### Files to modify

| File | Change |
|------|--------|
| `src/lib/canvas/editor-state.svelte.ts` | `#toolBeforeModifier`, `#isAltHeld` state, Alt handling, `handleKeyUp`, `handleBlur`, drawEnd modification |
| `src/lib/canvas/editor-state.svelte.test.ts` | `keyUp` helper, Alt eyedropper test suite |
| `src/routes/pixel/+page.svelte` | `onkeyup`, `onblur` event wiring |
| `src/routes/pebble/+page.svelte` | `onkeyup`, `onblur` event wiring |

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-state.svelte.ts` | Added `#toolBeforeModifier`, `#isAltHeld` state, Alt detection in `handleKeyDown`, new `handleKeyUp` and `handleBlur` methods, deferred restore in `handleDrawEnd` |
| `src/lib/canvas/editor-state.svelte.test.ts` | Added `keyUp` helper function and 8 test cases in "Alt eyedropper" describe block |
| `src/routes/pixel/+page.svelte` | Wired `onkeyup` and `onblur` to `<svelte:window>` |
| `src/routes/pebble/+page.svelte` | Wired `onkeyup` and `onblur` to `<svelte:window>` |
| `tasks/todo.md` | Added tool-specific mouse cursor item to review backlog |
