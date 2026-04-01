# 055 — Right-click draws with background color

## Plan

### Context

Right-click drawing with background color is a standard behavior in pixel art editors (Aseprite, etc.). Currently DOTORIXEL ignores right-click (`canvas-interaction.svelte.ts:138` — `if (!isLeftClick) return`). The background color state already exists in `EditorState` but is only used for the color preview UI.

### Key Design Decisions

**No Rust core change needed**: `ToolType::apply()` already receives a single "draw color" — the frontend decides which color to pass based on button. Eraser ignores the color param internally.

**Color determined at draw session start**: `handleDrawStart(button)` stores both `#drawButton` (for eyedropper foreground/background distinction) and `#activeDrawColor` (WasmColor for drawing tools). These persist for the entire drag gesture.

### Implementation

1. **`PixelCanvasView.svelte`** — Prevent context menu on canvas, preventDefault for right-click, update `onDrawStart` prop signature to `(button: number) => void`
2. **`canvas-interaction.svelte.ts`** — Add `button` field to drawing InteractionMode, restructure `pointerDown()` to accept button 0 or 2 as draw triggers (Space + right-click = panning), change `onDrawStart` callback to pass button, forward `interaction.button` from all 3 internal call sites
3. **`editor-state.svelte.ts`** — Add `#wasmBackgroundColor` derived state, `#drawButton` and `#activeDrawColor` fields, select draw color in `handleDrawStart(button)`, use `#activeDrawColor` in `handleDraw()`, eyedropper right-click sets background color
4. **Tests** — Update canvas-interaction tests (right-click drawing, button arg, Space+right-click panning), add editor-state tests (background color drawing per tool, eraser unchanged, eyedropper right-click)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/canvas-interaction.svelte.ts` | Accept right-click (button 2) as draw trigger, add `button` field to drawing InteractionMode, pass button through `onDrawStart` callback |
| `src/lib/canvas/editor-state.svelte.ts` | Add `#wasmBackgroundColor` derived, `#drawButton` and `#activeDrawColor` session fields, select draw color based on button, eyedropper right-click sets background color |
| `src/lib/canvas/PixelCanvasView.svelte` | Prevent context menu on canvas, preventDefault for right-click, update `onDrawStart` prop signature |
| `src/lib/canvas/canvas-interaction.svelte.test.ts` | Right-click drawing tests, button arg verification, Space+right-click panning, touch tap button passthrough |
| `src/lib/canvas/editor-state.svelte.test.ts` | Right-click background color tests for all tool types (pencil, eraser, floodfill, line, rectangle, ellipse, eyedropper), recent colors |

### Key Decisions

- No Rust core change: `ToolType::apply()` already receives a single "draw color" — the frontend selects foreground or background based on button. Simpler than the todo.md suggestion of adding a `background_color` param.
- Color determined at session start: `#activeDrawColor` is set once in `handleDrawStart` and reused for the entire drag gesture, ensuring consistency mid-stroke.
