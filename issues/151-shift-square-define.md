---
title: "Shift = square constraint during DefineMarquee"
status: done
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

When Shift is held during `DefineMarquee`, constrain the rectangle to a square — same semantics as Rectangle / Ellipse tools.

Scope:

- **Selection stroke session** (`tools/selection-tool.ts`): during `DefineMarquee`, read the physical keyboard Shift modifier state from the host (`host.isShiftHeld()`). When held, apply `constrainSquare(anchor, current)` (already exported from `tool-registry.ts`) to the draft region before previewing / committing.
- **Mid-drag modifier change**: the existing `modifierChanged` callback in the stroke session updates the draft preview when Shift is pressed or released mid-drag.
- **Touch path**: out of scope for this issue. Touch-reachable Shift-equivalent behavior belongs to the project-wide **Touch modifier alternatives** task, which will connect its global modifier state to this same Selection behavior.

Implementation notes:

- Reuse `constrainSquare` from `tool-registry.ts` — it already covers `Rectangle` and `Ellipse`.
- The constraint snaps the endpoint, not the anchor — drag direction is preserved.

Tests:

- Shift-held drag during DefineMarquee produces a square Marquee.
- Releasing Shift mid-drag returns the preview to free-form rectangle.
- Pressing Shift mid-drag re-applies the constraint.

## Acceptance criteria

- Physical keyboard Shift held during DefineMarquee constrains the Marquee to a square.
- Mid-drag physical Shift press/release updates the preview appropriately.

## Blocked by

- [132 — Selection foundation](132-selection-foundation.md)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/tools/selection-tool.ts` | Applies physical Shift square constraint during DefineMarquee, refreshes the preview on modifier changes, and preserves square geometry at canvas edges. |
| `src/lib/canvas/tools/selection-tool.test.ts` | Covers held Shift, mid-drag Shift press/release, and drags that cross canvas bounds. |
| `src/lib/canvas/tool-constraints.ts` | Extracts shared line/square constraint helpers for tools that need them without depending on the tool registry. |
| `src/lib/canvas/tool-registry.ts` | Re-exports the shared constraint helpers to preserve the existing public import path. |
| `src/lib/canvas/tools/shape-tool.ts` | Imports shape constraints from the shared helper module. |

### Key Decisions

- Shift-constrained Selection defines the visible Marquee as a square even when the pointer crosses canvas bounds. When a drag starts outside the canvas, the square anchor is projected to the nearest canvas edge before sizing the Marquee.
- Constraint helpers moved out of `tool-registry.ts` so Selection can reuse `constrainSquare` behavior without creating a registry/tool import cycle.

### Notes

- Touch-reachable Shift-equivalent behavior remains out of scope for this issue and belongs to the project-wide Touch modifier alternatives task.
- The remaining Selection PRD implementation issue is [152 — Shift = axis lock during Floating drag](152-shift-axis-lock-during-floating-drag.md).
