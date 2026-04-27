# Progress

## Currently Working On

Floating reference image windows ([PRD 053](../issues/053-floating-reference-window.md))

## Last Completed

Reference images — minimize (window-shade) — store gains `setMinimized` with same immutable-update + dirty-mark pattern as `setDisplayPosition`/`setDisplaySize`, `ReferenceWindow` adds `minimized` prop and `onMinimizeChange` callback, title-bar minimize button uses `ChevronUp`/`ChevronDown` to signal the next action, title-bar `ondblclick` toggles via `closest('button')` guard (same shield as the existing pointerdown drag), body and resize handle wrapped in `{#if !minimized}` so they leave the DOM (and the accessibility tree) when collapsed, container `style:height` switches to `auto` and `data-minimized` attribute drops the title-bar `border-bottom` for a clean pill silhouette, three new locales (`references_window_minimize` / `references_window_restore`) ([issue](../issues/058-reference-images-minimize.md))

## Next Up

- [059 — Reference images: z-order + cascade](../issues/059-reference-images-z-order-cascade.md)
  - Next slice of PRD 053. Can start immediately.
- [060 — Reference images: Eyedropper sampling](../issues/060-reference-images-eyedropper-sampling.md)
  - Sibling slice of PRD 053. Independent of 059.
- [062 — Reference images: drag-drop import](../issues/062-reference-images-drag-drop-import.md)
  - Sibling slice of PRD 053. Independent of 059/060.
- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Independent. Can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Same PRD as 018. Can start independently.
- Deepen per-stroke state — StrokeSession factory with typed openers ([plan](../issues/075-deepen-stroke-session.md))
  - Review-backlog refactor. Can start immediately.
