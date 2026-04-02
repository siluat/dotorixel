# 063 — Review keyboard shortcut assignments

## Plan

### Context

Tool shortcuts were initially assigned using first-letter mnemonics (P=Pencil, R=Rectangle, C=Ellipse, M=Move, etc.). Review these against Aseprite and other established editors, then realign for industry consistency and future-proofing.

### Changes

Three shortcuts change, seven remain:

| Tool | Before | After | Rationale |
|------|--------|-------|-----------|
| Rectangle | R | **U** | Aseprite standard. Frees R for future use. |
| Ellipse | C | **O** | Visual mnemonic (O resembles ellipse). Avoids Shift+U complexity. Frees C. |
| Move | M | **V** | Aseprite/Photoshop/GIMP/Figma standard. Reserves M for Selection (Milestone 3). |

Kept as-is: P (Pencil), E (Eraser), L (Line), F (Floodfill), I (Eyedropper), G (Grid toggle), X (Swap colors).

Full analysis: `docs/decisions/keyboard-shortcut-review.md`

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/canvas/editor-state.svelte.ts` | `TOOL_SHORTCUTS` map: KeyR→KeyU, KeyC→KeyO, KeyM→KeyV |
| `src/lib/canvas/editor-state.svelte.test.ts` | Update test mapping assertions |
| `src/lib/ui-pixel/Toolbar.svelte` | Labels and hint() calls: R→U, C→O, M→V |
| `src/lib/ui-editor/BottomToolsPanel.svelte` | Titles and hint() calls: R→U, C→O, M→V |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Titles and hint() calls: R→U, C→O, M→V |

### Verification

1. `bun run test` — tests pass
2. `bun run check` — type check passes
3. `bun run build` — production build succeeds
4. Browser: U/O/V keys work, old R/C/M keys do nothing, hint badges show correct letters

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-state.svelte.ts` | Updated `TOOL_SHORTCUTS` map: KeyR→KeyU, KeyC→KeyO, KeyM→KeyV |
| `src/lib/canvas/editor-state.svelte.test.ts` | Updated test mapping assertions to match new key codes |
| `src/lib/ui-pixel/Toolbar.svelte` | Updated labels and hint() calls for Rectangle (U), Ellipse (O), Move (V) |
| `src/lib/ui-editor/BottomToolsPanel.svelte` | Updated titles and hint() calls for Rectangle (U), Ellipse (O), Move (V) |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Updated titles and hint() calls for Rectangle (U), Ellipse (O), Move (V) |
| `docs/decisions/keyboard-shortcut-review.md` | Decision record with full comparison table, rationale, and key reservation plan |

### Key Decisions

- **P kept over B for Pencil**: Piskel/Pixel Studio use P; aligns with learning-first identity. Aseprite's B comes from Photoshop "Brush" heritage which is less intuitive for beginners.
- **O chosen for Ellipse instead of Shift+U**: Avoids Shift+key complexity (Shift is already the shape constraint modifier). O visually resembles an ellipse — strong mnemonic.
- **F kept for Floodfill despite Aseprite using G**: G is already assigned to Grid toggle. F=Fill matches Pyxel Edit and Lospec conventions.
- **M freed for future Selection tool**: M=Marquee is the universal convention (Aseprite, Photoshop, GIMP). Changing Move to V now avoids a forced breaking change when Selection is added in Milestone 3.
