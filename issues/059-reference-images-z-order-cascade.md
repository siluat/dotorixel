---
title: Reference images — multi-window z-order + cascade placement
status: open
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

Support multiple reference windows visible at once with predictable stacking and placement:

- **Cascade placement** — each newly-displayed reference appears ~24px down-right from the previous one, centered on the viewport for the first. Cascade resets once all windows are dismissed.
- **Auto LIFO z-order** — the most recently displayed or focused window is on top. Clicking an older window raises it to the top.
- **Persistence** — z-order survives reload and tab switch.

Also covers the re-display toggle from the gallery: clicking a non-displayed card displays the reference; clicking a displayed card raises it to the top and closes the modal (explicit "show" action).

## Acceptance criteria

- Toggling a second reference on from the gallery places it ~24px offset from the previous window and as top of the z-order.
- Clicking an older window raises it above the others.
- Z-order persists through reload.
- When all windows are closed, the next displayed reference starts fresh at the viewport center (cascade reset).
- Unit tests: store z-order updates on display + focus, cascade offset math, reset on empty set.
- Component tests: click-to-focus raises z-index; DOM stacking reflects `zOrder`.

## Blocked by

- [057 — Reference images — move + resize](057-reference-images-move-resize.md)

## Scenarios addressed

- Scenario 10 (second reference cascades and is on top)
- Scenario 11 (clicking older window raises it)
