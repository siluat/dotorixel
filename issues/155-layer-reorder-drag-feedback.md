---
title: "Layer panel: drag reorder feedback"
status: done
created: 2026-05-31
---

## What to build

Improve Timeline Panel layer reordering so users can see the row movement while dragging a layer reorder handle, instead of only seeing the final order after release.

## Acceptance criteria

- Dragging a Pixel Layer reorder handle visibly moves the dragged row before release.
- Rows between the source and target positions shift to show the pending drop position.
- Reference Layers remain fixed-bottom and cannot become reorder targets.
- The actual document reorder still commits only on drop.

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/TimelinePanel.svelte` | Added drag-preview state so the active row follows the pointer and displaced rows/frame cells shift before drop. |
| `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | Added component coverage that verifies drag preview state appears before `onReorderLayer` is called. |
| `e2e/editor/layers.test.ts` | Added browser coverage for drag-time preview styles and final layer order after drop. |
| `docs/platform-status.md` | Updated the Timeline panel row with the live reorder-preview behavior. |

### Key Decisions

- Kept the document reorder commit on pointer release; drag movement before release is a component-local visual preview only.
- Reused the existing Pixel Layer reorder target clamp so Reference Layers remain fixed-bottom during preview and commit.

### Notes

- This was a user-reported UX improvement and was not present as a `tasks/todo.md` item, so there was no todo row to remove.
