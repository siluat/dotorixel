---
title: "Selection Action Bar — Floating Selection state (Done / Cancel / Copy)"
status: ready-for-agent
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

Extend `SelectionActionBar.svelte` with the Floating Selection state. When a Floating is active, the bar switches its button set to `Done`, `Cancel`, `Copy` so touch users have explicit commit/revert/copy paths without a keyboard.

Scope:

- **State switch**: when `floatingSelection != null`, render `Done`, `Cancel`, `Copy` instead of the Idle buttons.
- **Done button**: commits the Floating at its current offset. Routes to the same path as a stroke `end` after `LiftAndDrag` — fires `commit-floating-selection`. After commit, the bar transitions back to the Idle state.
- **Cancel button**: reverts the Floating (same path as Escape — uses the cancel logic from 144).
- **Copy button**: captures the current Floating buffer (with offset applied) to the Selection Clipboard. The Floating remains active after the copy.
- **i18n**: `action_selectionDone`, `action_selectionCancel` (already added in 149 as part of the action bar's i18n keys; this slice ensures they cover Floating state).
- **Visibility / positioning**: same rules as Idle state — hidden mid-drag, fades back on release, repositions to viewport edges.

Implementation notes:

- The button set is reactive on the editor session's `floatingSelection` state.
- Copy in Floating state copies the floating buffer (with offset), matching the PRD's behavior matrix: "Cmd+C from Floating Selection state copies the floating buffer."
- Cancel of a pasted Floating reverts to pre-paste state (no pixels mutated; pre-paste Marquee restored — per 148).

Tests:

- Bar switches to `Done`, `Cancel`, `Copy` when Floating becomes active.
- Done dispatches `commit-floating-selection` and transitions back to Idle state buttons.
- Cancel dispatches the cancel path (revert + restore pre-Floating Marquee).
- Copy in Floating state captures the floating buffer to the Clipboard; Floating remains active.
- Bar transitions are correct across drag → release → action button presses.

## Acceptance criteria

- Action bar switches to Floating-state buttons whenever a Floating Selection is active.
- Done commits the Floating at current offset; bar transitions back to Idle state.
- Cancel reverts the Floating to pre-lift state (or pre-paste state for pasted Floating).
- Copy captures the floating buffer to the Clipboard without dismissing the Floating.
- Visibility / positioning behavior matches the Idle state's rules.

## Blocked by

- [149 — Selection Action Bar — Idle state implementation](149-selection-action-bar-idle-implementation.md)
- [142 — Selection drag-to-move](142-selection-drag-to-move.md)
- [144 — Escape cancels Floating Selection](144-escape-cancels-floating-selection.md)
