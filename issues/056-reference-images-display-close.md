---
title: Reference images — display on canvas + close
status: open
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

Clicking a gallery card displays the reference as a static floating window on the canvas; closing the window (X) removes it from the canvas but keeps the gallery entry. Establishes the overlay container, `ReferenceWindow` component skeleton, `DisplayState` persistence, and the pointer-absorb policy. No move/resize/minimize yet.

- **`DisplayState`** — per-instance record: refId, visible, x, y, width, height, minimized=false, zOrder. Persisted inside `WorkspaceRecord` (extends the map from #055).
- **Overlay container** — mounted on the editor page above the canvas, below editor chrome (TopBar, LeftToolbar, RightPanel, StatusBar). Renders one `ReferenceWindow` per visible `DisplayState` for the active tab.
- **`ReferenceWindow` component** — receives `ReferenceImage` + `DisplayState` via props; emits close via callback. Static frame: title bar + image body + close (X). Absorbs pointer events (no pass-through).
- **Initial placement & size** — viewport center with ~24px cascade offset (see PRD §Window Behavior); size = `min(natural, viewport × 0.3)` on the longer edge, aspect preserved; hard minimum ~80×80; clamped to viewport.
- **Close behavior** — X sets visible=false and persists; re-showing is out of scope for this slice (re-display UX lives with #055's gallery toggle wiring or a follow-up; for this slice, close + gallery delete are the two removal paths).

Note: re-display toggle (clicking a card for an already-closed reference to bring it back) should be wired here as part of the card-body click surface already added in #055 — clicking a non-displayed card displays it; clicking a displayed card… TBD in this slice (likely closes the modal without re-toggling; move toggle logic into #059 once z-order lands).

## Acceptance criteria

- Clicking a gallery card body closes the modal and displays the reference as a floating window centered in the viewport with cascade offset.
- Floating window renders thumbnail-free, full-resolution image at the computed initial size.
- Pointer events on the window do NOT reach the canvas underneath (drawing, clicking, etc. are absorbed).
- Close (X) hides the window; the gallery entry remains and the card reflects the non-displayed state.
- Reload restores visible windows at their persisted position/size; hidden windows stay hidden.
- Unit tests: store toggle/hide sequences, workspace round-trip preserves `DisplayState` including visible flag, initial-placement math.
- Component tests: `ReferenceWindow` close callback fires without removing the underlying ref record; pointer-absorb verified.

## Blocked by

- [055 — Reference images — gallery foundation](055-reference-images-gallery-foundation.md)

## Scenarios addressed

- Scenario 3 (card click → centered floating window, modal closes)
- Scenario 12 (close X → window disappears, gallery entry remains)
