---
title: "Escape cancels Floating Selection — revert lift mid-drag"
status: ready-for-agent
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
