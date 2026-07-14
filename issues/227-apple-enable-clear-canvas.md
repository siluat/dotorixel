---
title: Apple native — enable clear canvas (existing disabled button)
status: done
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

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/State/EditorState.swift` | `handleClearCanvas()` state handler — pushes the pre-clear snapshot, clears via the existing UniFFI `clear()`, bumps `canvasVersion`/`historyVersion`; shared `pushHistorySnapshot()` extracted from `handleDrawStart()` |
| `apple/Dotorixel/Views/RightPanel.swift` | Clear button enabled (`.disabled(true)` + `.opacity` removed) and wired to `handleClearCanvas()` |
| `apple/DotorixelTests/EditorStateTests.swift` | 5 behavior tests: pixels cleared, `canvasVersion` bump, undo restores, redo re-clears, no-op while drawing |
| `apple/DotorixelTests/__Snapshots__/DockedRegionSnapshotTests/rightPanelWide.1.png`, `rightPanelXWide.1.png` | Baselines re-recorded on the pinned host — Clear button now renders at full opacity |

### Key Decisions

- Handler named `handleClearCanvas` (not `handleClear`) to stay unambiguous next to
  the History domain's `clear()` while following the existing handler convention.
- Mirrors web behavior exactly: immediate clear with no confirmation dialog (undo is
  the safety net); the snapshot is pushed regardless of whether the canvas is empty.
- Visual parity with web `.clear-btn` confirmed (text-secondary, 1px border,
  radius 4, height 28).

### Notes

- Redo re-applies the clear through the existing history mechanism with no new code;
  the test locks that contract in as regression defense.
- Snapshot re-recording followed `apple/DotorixelTests/README.md` (pinned host:
  iPad Pro 11-inch (M5) · iOS 26.4 · @2x); images reviewed before commit.
