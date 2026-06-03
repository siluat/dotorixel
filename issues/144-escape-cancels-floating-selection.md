---
title: "Escape cancels Floating Selection — revert lift mid-drag"
status: done
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

Pressing Escape during a `LiftAndDrag` reverts both the source region (which was cleared on lift) and the in-flight buffer offset to the pre-drag state. Marquee position is restored to its pre-drag value. No journal commit fires.

Scope:

- **Selection stroke session** (`tools/selection-tool.ts`): add a cancel path that:
  - Restores the active layer pixels from the snapshot captured at `LiftAndDrag` start.
  - Discards the Floating buffer.
  - Restores the Marquee to the pre-drag region (it wasn't moved, but the in-progress preview offset is dropped).
  - Does NOT call `commit-floating-selection`.
- **Keyboard input** (`keyboard-input.svelte.ts`): the existing `clearMarqueeOrFloating()` host callback (introduced in 132 with Idle-state Marquee clear) now prioritizes Floating cancel — if a Floating Selection is active, cancel it; else clear the Marquee.
- **`SelectionOverlay.svelte`**: re-render after cancel — marching ants return to the pre-drag position.

Implementation notes:

- The active layer snapshot for restoration was already captured in 142's `LiftAndDrag` `start()` (per the PRD's commit-floating-selection design).
- This slice extends the snapshot path with the cancel branch that consumes it.
- Cancel preserves the Marquee — only the in-progress translation is dropped.

Tests:

- Selection stroke session: Escape during `LiftAndDrag` restores active layer pixels to pre-drag state.
- Selection stroke session: Escape during `LiftAndDrag` discards Floating buffer.
- Selection stroke session: Escape during `LiftAndDrag` does NOT fire `commit-floating-selection` journal intent.
- Marquee position after Escape matches pre-drag position.
- Escape with no Floating but with a Marquee continues to clear the Marquee (Idle-state Escape from 132 unchanged).

## Acceptance criteria

- Escape during `LiftAndDrag` restores source pixels (un-clears the lift).
- Escape during `LiftAndDrag` discards the Floating buffer.
- Escape during `LiftAndDrag` does not commit a journal intent.
- Marquee position after Escape is the pre-drag position.
- Escape with only a Marquee (Idle) continues to clear the Marquee (regression test for 132 behavior).

## Blocked by

- [142 — Selection drag-to-move](142-selection-drag-to-move.md)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/tools/selection-tool.test.ts` | Locked the Selection stroke cancel contract so a canceled Floating drag emits cancel, not commit. |
| `src/lib/canvas/keyboard-input.svelte.ts` | Routed Escape through a host callback that can prioritize Floating Selection cancel before Marquee clear. |
| `src/lib/canvas/keyboard-input.svelte.test.ts` | Covered Escape delegation during idle and drawing states. |
| `src/lib/canvas/editor-session/create-editor-controller.ts` | Wired keyboard Escape delegation to the active tab's clear-or-cancel behavior. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Added the active-tab operation that cancels Floating Selection when present, otherwise clears Marquee. |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | Covered Floating cancel pixel restoration, Marquee preservation, no dirty commit, and idle Marquee clear fallback. |
| `src/lib/canvas/editor-session/editor-controller.svelte.test.ts` | Covered the wired keyboard-to-tab Escape path end to end. |
| `src/lib/canvas/canvas-interaction.svelte.ts` | Added external draw cancellation so view-level pointer state returns to idle after Escape. |
| `src/lib/canvas/canvas-interaction.svelte.test.ts` | Covered external draw cancellation ignoring the later pointer-up. |
| `src/lib/canvas/PixelCanvasView.svelte` | Scoped Escape draw cancellation to active Floating Selection drags and cleared selection drag aids. |
| `src/lib/canvas/PixelCanvasView.svelte.test.ts` | Covered Floating Selection Escape cancel at the view layer and guarded non-selection drawing from the new path. |

### Key Decisions

- Escape cancellation is handled through the existing Floating Selection snapshot path, so cancel restores source pixels and Marquee without creating a journal commit.
- View-level interaction cancellation is scoped to Selection Floating drags only; other active drawing tools keep their existing pointer lifecycle.

### Notes

- Parent PRD remains open; nudge, cut/paste, action bar, and Shift-specific selection follow-ups are still pending.
