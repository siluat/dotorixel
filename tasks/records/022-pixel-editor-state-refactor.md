# 022 — Pixel page EditorState refactor

## Plan

The Pixel page (`src/routes/pixel/+page.svelte`) reimplements all state and logic locally, while the Pebble page uses the shared `EditorState` class. This causes new features (e.g., line/rectangle snapshot-restore preview) to only appear in Pebble, requiring duplicate work for Pixel.

Refactor the Pixel page to use `EditorState`, so that adding a feature to the shared class automatically enables it in both themes.

### Target file

- `src/routes/pixel/+page.svelte` — only file modified

### Changes

**`<script>` section — full replacement:**
- Remove local state, derived values, 15 handler functions, and direct WASM imports (~200 lines)
- Replace with `EditorState` import and instance creation

**Template bindings:**
- Replace local variable references with `editor.xxx`
- e.g., `{activeTool}` → `{editor.activeTool}`, `onUndo={handleUndo}` → `onUndo={editor.handleUndo}`

**`<style>` section:** No changes

### Verification

1. `bun run check` — no type errors
2. `bun run test` — all existing tests pass
3. Verify all features work on `/pixel` page in browser

## Results

| File | Description |
|------|-------------|
| `src/routes/pixel/+page.svelte` | Replaced ~200 lines of local state/handlers with `EditorState`; added `justify-self: center` to fix canvas-panel size mismatch |

### Key Decisions

- Canvas panel mismatch fix: used `justify-self: center` on `.cell-canvas` to shrink-wrap the PixelPanel to the canvas size, rather than expanding the canvas to fill the panel via ResizeObserver

### Notes

- Pixel page now automatically gains line/rectangle snapshot-restore preview (previously Pebble-only)
- Both theme pages follow the same pattern: create `EditorState`, bind to theme-specific UI components
