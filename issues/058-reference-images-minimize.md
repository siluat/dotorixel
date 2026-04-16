---
title: Reference images — minimize (window-shade)
status: open
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

Add window-shade minimize: a minimize button in the title bar (and double-click on title bar) collapses the image area, leaving only the title bar in place. Restoring returns to the previous size. Minimize state persists.

- `DisplayState.minimized` flag toggles the collapsed presentation.
- Minimized window keeps its position; unminimize restores the last width/height.
- Double-click on title bar mirrors the button.
- Minimized windows remain draggable (title bar still interactive) but not resizable.

## Acceptance criteria

- Clicking minimize collapses the body; only the title bar is visible.
- Double-clicking the title bar toggles minimize state.
- Restoring returns to the pre-minimize size; position does not change.
- Minimize state persists across reload and tab switch.
- A minimized window can still be moved by dragging its title bar.
- Unit tests: store minimize toggle, round-trip preserves `minimized` flag.
- Component tests: minimize button + double-click both toggle; collapsed layout renders title bar only; resize handle not interactive while minimized.

## Blocked by

- [057 — Reference images — move + resize](057-reference-images-move-resize.md)

## Scenarios addressed

- Scenario 6 (minimize collapses to title bar; restore expands; double-click title bar also toggles)
