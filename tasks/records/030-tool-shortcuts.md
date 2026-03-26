# 030 — Tool shortcuts (P, E, L, F, I, R, C, G)

## Plan

### Context

Add keyboard shortcuts for fast tool switching without the mouse.
Currently `EditorState.handleKeyDown()` only handles Ctrl+Z/Shift+Z (undo/redo) — no tool switching shortcuts exist.

**Scope decision**: Shortcut hints shown only via tooltip (title attribute). On-demand badge overlay (show shortcut on key hold) deferred to a separate task after all keyboard shortcut work is complete.

### Key Mapping

| Key | Target | Type |
|---|---|---|
| P | pencil | Tool switch |
| E | eraser | Tool switch |
| L | line | Tool switch |
| R | rectangle | Tool switch |
| C | ellipse | Tool switch |
| F | floodfill | Tool switch |
| I | eyedropper | Tool switch |
| G | grid toggle | Action |

### Implementation

#### 1. Add shortcut mapping constant — `editor-state.svelte.ts`

```typescript
const TOOL_SHORTCUTS: Record<string, ToolType> = {
  p: 'pencil',
  e: 'eraser',
  l: 'line',
  r: 'rectangle',
  c: 'ellipse',
  f: 'floodfill',
  i: 'eyedropper'
};
```

Defined as a module-level constant. No need to create per `EditorState` instance.

#### 2. Extend `handleKeyDown` — `editor-state.svelte.ts`

Add shortcut handling after the existing Ctrl+Z/Shift+Z branches:

- Ignore when modifier keys (Ctrl/Cmd/Alt/Shift) are held — prevents conflict with browser defaults (Ctrl+P=print, etc.)
- Ignore tool switching while drawing (`#isDrawing`) — protects in-progress tool operations
- Look up mapping via `event.key.toLowerCase()`
- G key: call `handleGridToggle()` (allowed even while drawing — view setting, does not affect tool operations)
- Add `event.repeat` guard for G key — prevents grid flickering when key is held down (tool switching is idempotent, so not needed there)

#### 3. Add shortcut hints to toolbar titles

- **Pixel UI** (`Toolbar.svelte`): Add shortcut to `label` field (e.g., `'Pencil'` → `'Pencil (P)'`)
  - Grid toggle button: `'Toggle Grid'` → `'Toggle Grid (G)'`
- **Pebble UI** (`BottomToolsPanel.svelte`): Apply same pattern to `title` attribute
  - Also apply to Grid toggle button in `TopControlsLeft.svelte`

#### 4. Add follow-up task to `todo.md`

Add on-demand shortcut badge overlay item to Keyboard Shortcuts section:
- "On-demand shortcut hint badges (show on key hold, toggle off in settings)"

#### 5. Add tests — `editor-state.svelte.test.ts`

Test by directly calling `EditorState.handleKeyDown`:

- Verify tool switching for each shortcut key (P, E, L, F, I, R, C)
- Verify grid toggle with G key
- Verify uppercase keys (CapsLock without Shift) work
- Verify modifier keys (Ctrl, Alt, etc.) are ignored
- Verify tool shortcut keys are ignored while drawing
- Verify G key `event.repeat` is ignored for grid toggle
- Verify ignored when interactive element is focused (may skip due to JSDOM limitations)

### Files to Modify

| File | Change |
|---|---|
| `src/lib/canvas/editor-state.svelte.ts` | Shortcut mapping constant, handleKeyDown extension |
| `src/lib/canvas/editor-state.svelte.test.ts` | Shortcut tests |
| `src/lib/ui-pixel/Toolbar.svelte` | Shortcut hints in labels |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Shortcut hints in titles |
| `src/lib/ui-pebble/TopControlsLeft.svelte` | Shortcut hint in Grid toggle title |
| `tasks/todo.md` | Add on-demand badge follow-up item |

### Verification

1. `bun run test` — Verify new tests pass
2. `bun run check` — Verify type checking passes
3. In browser, verify tool switching with P/E/L/R/C/F/I keys and grid toggle with G key
4. Verify shortcut hints appear on toolbar button hover

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-state.svelte.ts` | Added `TOOL_SHORTCUTS` constant, extended `handleKeyDown` with tool/grid shortcuts, added `typeof HTMLElement` guard to `isInteractiveTarget` |
| `src/lib/canvas/editor-state.svelte.test.ts` | Added 9 tests for shortcut behavior (tool switching, grid toggle, CapsLock, modifier keys, drawing guard, repeat guard) |
| `src/lib/ui-pixel/Toolbar.svelte` | Added shortcut hints to tool and grid toggle labels |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Added shortcut hints to tool button titles |
| `src/lib/ui-pebble/TopControlsLeft.svelte` | Added shortcut hint to grid toggle title |
| `tasks/todo.md` | Replaced completed item with follow-up on-demand badge overlay item |

### Key Decisions
- Used a plain object mock for `KeyboardEvent` in tests instead of adding JSDOM dependency — the test environment is Node.js without DOM, and the tests target `EditorState` logic, not DOM behavior.
- Added `typeof HTMLElement === 'undefined'` guard to `isInteractiveTarget` — improves SSR safety beyond just test convenience.

### Notes
- The `handleKeyDown` undo/redo block doesn't early-return after execution, falling through to the modifier guard. This is pre-existing behavior, not introduced by this change.
