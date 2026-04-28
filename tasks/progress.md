# Progress

## Currently Working On

Floating reference image windows ([PRD 053](../issues/053-floating-reference-window.md))

## Last Completed

Reference images — multi-window z-order + cascade — store gains `nextCascadeIndex(docId)` (count of currently visible windows) so cascade resets to viewport-center after all windows are dismissed; `+page.svelte` swaps the inline `displayStatesForDoc(docId).length` for the new query (the inline version counted hidden states forever) and `handleReferenceSelect` now always calls `store.show()` then closes the modal (bug fix: clicking an already-displayed card now raises it instead of early-returning); `ReferenceWindow` adds optional `onActivate` callback fired from a root `pointerdown` with a `.title-bar-button` guard (close/minimize don't flicker-raise) and gains `tabindex="-1"`; defensive `e.stopPropagation()` removed from resize-handle pointerdown so resize also bubbles to root and raises; `ReferenceWindowOverlay` wires `onActivate` → `store.show(refId, docId)` (skipped when already top-of-z to avoid spurious dirty marks); `store.show()` was already idempotent for visible windows (bumps zOrder above max), so it serves as the single path for both re-display and raise ([issue](../issues/059-reference-images-z-order-cascade.md))

## Next Up

- [060 — Reference images: Eyedropper sampling](../issues/060-reference-images-eyedropper-sampling.md)
  - Next slice of PRD 053. Can start immediately.
- [061 — Reference images: long-press sampling](../issues/061-reference-images-long-press-sampling.md)
  - Sibling slice of PRD 053. Builds on 060 (Eyedropper) for touch entry.
- [062 — Reference images: drag-drop import](../issues/062-reference-images-drag-drop-import.md)
  - Sibling slice of PRD 053. Independent of 060/061.
- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Independent. Can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Same PRD as 018. Can start independently.
- Deepen per-stroke state — StrokeSession factory with typed openers ([plan](../issues/075-deepen-stroke-session.md))
  - Review-backlog refactor. Can start immediately.
