---
title: "Selection — click-without-drag deselects existing Marquee"
status: ready-for-agent
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

When a user clicks on the canvas without producing a drag (release before any pointer movement crossing 1 doc pixel), the Selection stroke session interprets the gesture as a deselect — not a 1×1 marquee.

Behavior:

- Click outside existing Marquee, no drag → Marquee cleared.
- Click inside existing Marquee, no drag → no-op (Marquee preserved; matches "inside click = move start" semantics, but with zero drag the move never starts and the Marquee stays).
- Click with no existing Marquee, no drag → no-op (nothing to clear).
- Drag ≥ 1 doc pixel outside Marquee → DefineMarquee path (already in 132).

Scope:

- Extend the Selection stroke session (`tools/selection-tool.ts`) to track drag distance and resolve the click-without-drag path on release.
- The threshold is `drag distance < 1 doc px`. Use `CanvasCoords` integer rounding to determine.
- Tests in the stroke session test file cover the four cases above.

## Acceptance criteria

- Click outside Marquee, no drag → Marquee cleared via `set-marquee: { region: null }` journal intent.
- Click inside Marquee, no drag → no journal intent fires, Marquee unchanged.
- Click with no Marquee, no drag → no journal intent fires.
- Drag ≥ 1 doc pixel outside Marquee continues to take the DefineMarquee path.
- Tests for all four cases in the Selection stroke session test file.

## Blocked by

- [132 — Selection foundation](132-selection-foundation.md)
