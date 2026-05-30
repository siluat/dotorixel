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

- **Selection stroke session** (`tools/selection-tool.ts`): during `DefineMarquee`, read the Shift modifier state from the host (`host.isShiftHeld()`). When held, apply `constrainSquare(anchor, current)` (already exported from `tool-registry.ts`) to the draft region before previewing / committing.
- **Mid-drag modifier change**: the existing `modifierChanged` callback in the stroke session updates the draft preview when Shift is pressed or released mid-drag.
- **Touch path**: depends on the **Touch modifier alternatives** project-wide task that exposes Shift as a touch-reachable toggle. When that toggle is on (in the global modifier system), the constraint applies.

Implementation notes:

- Reuse `constrainSquare` from `tool-registry.ts` — it already covers `Rectangle` and `Ellipse`.
- The constraint snaps the endpoint, not the anchor — drag direction is preserved.

Tests:

- Shift-held drag during DefineMarquee produces a square Marquee.
- Releasing Shift mid-drag returns the preview to free-form rectangle.
- Pressing Shift mid-drag re-applies the constraint.
- Touch with Shift toggle on (from Touch modifier alternatives) produces a square Marquee.

## Acceptance criteria

- Shift held during DefineMarquee constrains the Marquee to a square.
- Mid-drag press/release of Shift updates the preview appropriately.
- Once Touch modifier alternatives lands, touch users can engage the same square constraint via the project-wide modifier toggle.

## Blocked by

- [132 — Selection foundation](132-selection-foundation.md)
- **External**: `Touch modifier alternatives` project-wide task (currently in `tasks/todo.md`, no issue yet). The touch path of this slice depends on that task's PRD/issues materializing first.
