# 033 — Edit shortcuts (Ctrl+Z/Y, X=swap colors)

## Plan

### Context

Undo/redo and color swap features are already implemented, but keyboard bindings are incomplete.

Current state:
- **Ctrl+Z** (undo): Already implemented
- **Ctrl+Shift+Z** (redo): Already implemented
- **Ctrl+Y** (redo): **Not implemented** — alternative binding used by many editors
- **X** (swap colors): **Not implemented** — `swapColors()` method exists but has no keyboard binding

### Implementation Plan

#### 1. Add Ctrl+Y redo shortcut

**File**: `src/lib/canvas/editor-state.svelte.ts` (around lines 335-343)

Current code:
```typescript
const isCtrlOrCmd = event.ctrlKey || event.metaKey;
const isZKey = event.key.toLowerCase() === 'z';
if (isCtrlOrCmd && isZKey && !event.shiftKey) {
    event.preventDefault();
    this.handleUndo();
} else if (isCtrlOrCmd && isZKey && event.shiftKey) {
    event.preventDefault();
    this.handleRedo();
}
```

Change: Add an `else if` branch so Ctrl+Y also calls `handleRedo()`.

```typescript
const isCtrlOrCmd = event.ctrlKey || event.metaKey;
const isZKey = event.key.toLowerCase() === 'z';
const isYKey = event.key.toLowerCase() === 'y';
if (isCtrlOrCmd && isZKey && !event.shiftKey) {
    event.preventDefault();
    this.handleUndo();
} else if ((isCtrlOrCmd && isZKey && event.shiftKey) || (isCtrlOrCmd && isYKey)) {
    event.preventDefault();
    this.handleRedo();
}
```

#### 2. Add X key swap colors shortcut

**File**: `src/lib/canvas/editor-state.svelte.ts` (after line 345, after modifier guard)

Add X key handling following the same pattern as the Grid toggle (G). Since `swapColors()` is safe during drawing, place it before the `#isDrawing` guard.

```typescript
if (event.code === 'KeyX') {
    if (event.repeat) return;
    this.swapColors();
    return;
}
```

Placement: After G key handling, before `#isDrawing` guard.

> Add `event.repeat` guard like G key. Prevents repeated color swapping when X is held down.

#### 3. Add tests

**File**: `src/lib/canvas/editor-state.svelte.test.ts`

Follow existing test patterns to add new describe blocks or cases.

**Ctrl+Y tests** (add to existing undo/redo test area):
- Verify redo works via Ctrl+Y
- Verify both Ctrl+Y and Ctrl+Shift+Z produce the same result

**X key tests** (add to tool shortcuts section):
- Verify X key swaps foreground/background colors
- Verify Ctrl/Meta/Alt/Shift + X is ignored (automatically blocked by modifier guard)
- Verify `event.repeat` is ignored
- Verify X key works during drawing

### Files to modify

| File | Changes |
| --- | --- |
| `src/lib/canvas/editor-state.svelte.ts` | Add Ctrl+Y redo, add X key swapColors |
| `src/lib/canvas/editor-state.svelte.test.ts` | Add new shortcut test cases |

### Verification

1. `bun run test` — All existing + new tests pass
2. `bun run dev` — Manual browser verification:
   - Ctrl+Z/Ctrl+Y/Ctrl+Shift+Z work correctly
   - X key swaps foreground/background colors
   - Works with Korean IME mode
3. `bun run build` — Production build succeeds

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-state.svelte.ts` | Added Ctrl+Y / Cmd+Y as redo alternative, added X key for swapColors |
| `src/lib/canvas/editor-state.svelte.test.ts` | Added 6 test cases: 3 for Ctrl+Y redo, 3 for X swap colors shortcut |

### Key Decisions
- X key placed after modifier guard but before `#isDrawing` guard, so it works during drawing (matching G key pattern) while Ctrl+X is automatically ignored
- Ctrl+Y merged into the existing Ctrl+Shift+Z branch with an OR condition rather than a separate branch, keeping the redo logic in one place
