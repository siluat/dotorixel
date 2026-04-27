# Progress

## Currently Working On

Floating reference image windows ([PRD 053](../issues/053-floating-reference-window.md))

## Last Completed

Reference images — display on canvas + close — `DisplayState` per-instance record (refId, visible, x/y/w/h, minimized, zOrder), `ReferenceWindow` component (title bar + close X, pointer-absorb, active/inactive styling), `ReferenceWindowOverlay` with render-time viewport fit (preserves stored intent for responsive resize), Eye/EyeOff toggle on gallery cards, forward-compat `WorkspaceRecord.displayStates?` round-trip. Initial placement now caps to viewport so extreme aspect ratios stay visible on mobile ([issue](../issues/056-reference-images-display-close.md))

## Next Up

- [057 — Reference images: move + resize](../issues/057-reference-images-move-resize.md)
  - Next slice of PRD 053 — adds drag-to-move and edge/corner resize on floating windows.
- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Independent. Can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Same PRD as 018. Can start independently.
- Deepen per-stroke state — StrokeSession factory with typed openers ([plan](../issues/075-deepen-stroke-session.md))
  - Review-backlog refactor. Can start immediately.
