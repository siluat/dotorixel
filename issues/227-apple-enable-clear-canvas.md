---
title: Apple native — enable clear canvas (existing disabled button)
status: ready-for-agent
created: 2026-07-14
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 1: Layout
finish, "quick wins" group.

## What to build

The Apple shell's RightPanel already renders a Clear button in its Canvas section,
but it is permanently disabled with its action intentionally unwired. Enable it:
tapping Clear erases every pixel on the canvas (back to transparent) and the Metal
view re-renders immediately.

Clear must be **history-integrated**, matching web behavior: the pre-clear pixels are
pushed onto the undo stack before clearing, so undo restores the drawing and redo
re-applies the clear. The web performs the clear directly with no confirmation
dialog — mirror that (undo is the safety net).

The core operation already exists across the FFI boundary (`ApplePixelCanvas.clear()`
in the UniFFI bindings); this slice is shell wiring only — a state handler on
`EditorState` following the existing handler conventions (history snapshot push +
manual version bumps for `@Observable` change detection), plus enabling the button.

## Acceptance criteria

- The Clear button in RightPanel is enabled (full opacity, tappable).
- Tapping Clear erases all pixels to transparent and the canvas re-renders without
  further interaction.
- Undo after Clear restores the pre-clear pixels; redo re-applies the clear.
- Clear is a no-op guard case while a drawing stroke is in progress (consistent with
  the undo/redo handlers).
- Unit tests cover the state handler: pixels cleared, undo restores, redo re-clears,
  version counters bumped.

## Blocked by

None - can start immediately.
