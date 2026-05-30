---
title: "Shift = axis lock during Floating Selection drag"
status: ready-for-agent
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

When Shift is held during a Floating Selection drag, constrain the translation to either the horizontal or vertical axis (whichever has the larger initial delta wins).

Scope:

- **Selection stroke session** (`tools/selection-tool.ts`): during `LiftAndDrag`, when `host.isShiftHeld()` is true, apply a new `constrainAxis(anchor, current)` helper to the live offset.
- **`constrainAxis` helper** (`tool-registry.ts`, new): given an anchor and current point, returns a point on the axis (horizontal or vertical from anchor) with the larger absolute delta. Mirrors the `constrainSquare` pattern.
- **Mid-drag modifier change**: the existing `modifierChanged` callback updates the floating offset when Shift is pressed or released mid-drag.
- **Touch path**: depends on the **Touch modifier alternatives** project-wide task.

Implementation notes:

- The axis is determined by the larger absolute delta *at the time Shift is held*, not the initial drag delta. If the user releases Shift, mid-drag, the offset returns to free 2D; re-pressing Shift re-locks to whichever axis is currently larger.
- The constraint applies to the Floating buffer's offset, not to the Marquee position directly — the marching ants follow the constrained offset.

Tests:

- Shift held during LiftAndDrag constrains the offset to a single axis.
- Mid-drag press/release of Shift updates the offset constraint.
- Whichever axis (horizontal vs vertical) has the larger absolute delta at the time Shift is held wins.
- Touch with Shift toggle on (from Touch modifier alternatives) constrains the offset.

## Acceptance criteria

- Shift held during LiftAndDrag constrains the Floating Selection offset to one axis.
- Mid-drag modifier changes update the offset constraint reactively.
- Once Touch modifier alternatives lands, touch users can engage the axis lock via the project-wide modifier toggle.

## Blocked by

- [142 — Selection drag-to-move](142-selection-drag-to-move.md)
- **External**: `Touch modifier alternatives` project-wide task. The touch path of this slice depends on that task's PRD/issues materializing first.
