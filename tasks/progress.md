# Progress

## Currently Working On

Floating reference image windows ([PRD 053](../issues/053-floating-reference-window.md))

## Last Completed

Reference images — multi-window z-order + cascade — store gains `nextCascadeIndex(docId)` (count of currently visible windows) so cascade resets to viewport-center after all windows are dismissed; the inline `displayStatesForDoc(docId).length` (which kept counting hidden states forever) is replaced with the new query; gallery-card click orchestration extracted to `selectReference()` in `select-reference.ts` — when the card has an existing display state it calls `store.show()` (which bumps `zOrder` above the current max, raising the window), otherwise it falls through to `displayReference()`, and the modal closes after either path (bug fix: the previous displayed-card branch early-returned and never raised z-order); `ReferenceWindow` adds optional `onActivate` callback fired from a root `pointerdown` with a `.title-bar-button` guard (close/minimize don't flicker-raise) and gains `tabindex="-1"`; defensive `e.stopPropagation()` removed from resize-handle pointerdown so resize also bubbles to root and raises; `ReferenceWindowOverlay` wires `onActivate` → `store.show(refId, docId)`, skipped when already top-of-z to avoid spurious dirty marks ([issue](../issues/059-reference-images-z-order-cascade.md))

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
