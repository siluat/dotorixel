# Progress

## Currently Working On

Floating reference image windows ([PRD 053](../issues/053-floating-reference-window.md))

## Last Completed

Reference images — move + resize — title-bar drag updates `DisplayState.x/y` (with X-button guard), bottom-right handle resize via dominant-axis aspect-locked math (`computeResize`) with shared `MIN_WINDOW_EDGE = 80` floor, release-time `clampPosition` keeps the window fully inside viewport so the title bar stays grabbable, store gains `setDisplayPosition`/`setDisplaySize` with auto-save dirty marking, resize handle has 44×44 invisible hit area (`::before`) and subtle diagonal grip indicator (`::after`) ([issue](../issues/057-reference-images-move-resize.md))

## Next Up

- [058 — Reference images: minimize (window-shade)](../issues/058-reference-images-minimize.md)
  - Next slice of PRD 053 — collapses window body to title bar only.
- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Independent. Can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Same PRD as 018. Can start independently.
- Deepen per-stroke state — StrokeSession factory with typed openers ([plan](../issues/075-deepen-stroke-session.md))
  - Review-backlog refactor. Can start immediately.
