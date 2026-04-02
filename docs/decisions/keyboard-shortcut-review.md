# Keyboard Shortcut Assignment Review

Review of tool shortcut assignments against Aseprite and other established pixel art editors. Conducted during Milestone 2 to align shortcuts before tooltip implementation.

Reference: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/dotori/03_Resources/references/pixel-art-editor-keyboard-shortcuts.md`

## Comparison

| Tool | Before | Aseprite | Piskel | Pixel Studio | After | Changed? |
|------|--------|----------|--------|--------------|-------|----------|
| Pencil | P | B | P | P | **P** | No |
| Eraser | E | E | E | E | **E** | No |
| Line | L | L | L | — | **L** | No |
| Rectangle | R | U | R | — | **U** | Yes |
| Ellipse | C | Shift+U | C | — | **O** | Yes |
| Floodfill | F | G | B | B | **F** | No |
| Eyedropper | I | I | O | I | **I** | No |
| Move | M | V | — | M | **V** | Yes |
| Grid toggle | G | Ctrl+' | — | — | **G** | No |
| Swap colors | X | X | — | — | **X** | No |

## Decisions

### R → U (Rectangle)

Aligns with Aseprite convention. Frees R for future use (Rotate, etc.). The shortcut hint badge system (/ key hold) ensures discoverability despite the less obvious mnemonic.

### C → O (Ellipse)

Aseprite uses Shift+U, but DOTORIXEL's hint badge system assumes single-character display and Shift is already the shape constraint modifier. O visually resembles an ellipse — a strong mnemonic that avoids the Shift+key complexity. Freeing C for future use (Clone, Crop, etc.).

### M → V (Move)

Aseprite, Photoshop, GIMP, and Figma all use V for Move. The Milestone 3 roadmap includes Selection tool, for which M (Marquee) is the universal convention. Changing Move to V now avoids a forced breaking change when Selection is added later.

### P kept (Pencil)

Aseprite uses B (Photoshop "Brush" heritage). Both Piskel and Pixel Studio use P. "P for Pencil" is the most intuitive mnemonic for beginners, consistent with DOTORIXEL's learning-first identity.

### F kept (Floodfill)

Aseprite uses G for Fill, but G is already assigned to Grid toggle in DOTORIXEL. Changing Grid would break established muscle memory without clear benefit. F for Fill matches Pyxel Edit and Lospec conventions.

### E, L, I, X, G kept

These are universal standards across all surveyed editors. No change needed.

## Key Reservation

Keys freed or reserved for future tools:

| Key | Intended Use | Timeline |
|-----|-------------|----------|
| M | Selection (Marquee) | Milestone 3 |
| Z | Zoom tool | When needed |
| H | Hand/Pan tool | When needed |
| B | Available (Brush variant, etc.) | — |
| R | Available (Rotate, etc.) | — |
| C | Available (Clone, Crop, etc.) | — |
| S | Available (Stamp, Selection alias, etc.) | — |
| D | Available (Default colors, etc.) | — |
