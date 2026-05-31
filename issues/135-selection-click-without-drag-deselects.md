---
title: "Selection — click-without-drag deselects existing Marquee"
status: done
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

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/tools/selection-tool.ts` | Tracks Selection stroke movement by document pixel and resolves click-without-drag outside an existing Marquee as a clear effect. |
| `src/lib/canvas/tools/selection-tool.test.ts` | Covers outside-click clear, inside-click no-op, no-Marquee click no-op, and 1+ document-pixel drag defining a new Marquee. |

### Key Decisions

- Treat a Selection stroke as a drag only after the current document pixel differs from the anchor pixel, avoiding accidental 1x1 Marquees from stationary clicks.
- Return `setMarquee: null` as the stroke effect for outside-click deselect so the Document Change Journal owns the undoable change.

### Notes

- Inside-click remains a no-op until the future drag-to-move work starts using that gesture.
