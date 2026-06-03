---
title: "Selection Action Bar — Floating Selection state (Done / Cancel / Duplicate)"
status: done
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

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/SelectionActionBar.svelte` | Added Floating Selection action mode with Done, Cancel, and Duplicate controls, plus projected positioning for live Floating offsets. |
| `src/lib/canvas/PixelCanvasView.svelte` | Wired Floating action callbacks through the canvas view. |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | Exposed controller handlers for explicit Floating commit and duplicate actions. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Kept Floating Selection active after drag release, added explicit duplicate behavior, and preserved cancelability across repeated drags. |
| `src/lib/canvas/tools/selection-tool.ts` | Stopped drag release from implicitly committing LiftAndDrag sessions. |
| `src/routes/editor/+page.svelte` | Connected Floating action handlers in desktop and mobile editor layouts. |
| `messages/en.json`, `messages/ko.json`, `messages/ja.json` | Added localized Floating Selection action labels. |
| `src/lib/canvas/*Selection*.test.ts`, `src/lib/canvas/editor-session/*.test.ts`, `src/lib/canvas/tools/selection-tool.test.ts` | Covered Floating action rendering, explicit commit/cancel/duplicate, release behavior, and repeated-drag cancel semantics. |

### Key Decisions

- Replaced the originally planned Floating `Copy` button with `Duplicate`: clipboard copy gives touch users no immediate paste path, while duplicate creates a movable copy in-place.
- `Duplicate` commits the current Floating Selection, then creates a new Floating copy offset 1 px down-right so it is immediately visible and draggable.
- Repeated drags inside the live Floating Selection remain transient until Done or another explicit commit path, so Cancel still reverts the uncommitted Floating state.

### Notes

- Shift square define and axis-lock Floating drag remain blocked by the project-wide Touch modifier alternatives task.
- No Apple shell changes were made.
- Verified with targeted selection tests, `bun run check`, and browser manual flows for drag/re-drag/Cancel and Duplicate/drag/Cancel.
