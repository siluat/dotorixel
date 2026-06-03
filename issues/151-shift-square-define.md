---
title: "Shift = square constraint during DefineMarquee"
status: ready-for-agent
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
