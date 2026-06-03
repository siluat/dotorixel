---
title: "Clear Canvas / Delete Layer — commit Floating Selection first"
status: done
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

When the user triggers Clear Canvas or Delete Layer while a Floating Selection is active, commit the Floating at its current offset first, then run the destructive operation. The Marquee itself is preserved across both operations.

Scope:

- **Clear Canvas action** (whoever owns the Clear Canvas dispatch — likely `EditorController` or a shared handler):
  - If a Floating Selection is active → commit it via `commit-floating-selection` (uses the existing 142 path).
  - Then proceed with the existing Clear Canvas mutation (which clears active layer pixels).
  - Marquee is preserved.
- **Delete Layer action**: same pattern — commit Floating first, then delete the layer (which removes the just-committed pixels). The Marquee persists onto whatever layer becomes active next (per Marquee = Document-scoped, decision in 132/138).
- **Undo behavior**: Clear Canvas after a commit-Floating produces two undo entries (commit then clear). One Undo step restores the cleared pixels including the committed Floating; a second Undo step reverts the Floating commit back to the pre-drag state.

Implementation notes:

- The destructive actions are existing flows; this slice adds the "commit Floating first" pre-step.
- The Clipboard is unaffected.
- The Selection Clipboard is workspace-scoped — Delete Layer does not affect it.

Tests:

- Clear Canvas with active Floating Selection: Floating commits first, then clears.
- Delete Layer with active Floating Selection: Floating commits first, then deletes.
- After Clear Canvas / Delete Layer, the Marquee is preserved.
- Undo after Clear Canvas with active Floating restores cleared pixels (including the committed Floating content).
- Two-step Undo brings the Floating back to its pre-commit state.

## Acceptance criteria

- Clear Canvas with active Floating Selection commits the Floating first, then runs Clear Canvas.
- Delete Layer with active Floating Selection commits the Floating first, then deletes the layer.
- Marquee is preserved across both operations.
- Undo sequence is consistent — each user-visible step has a corresponding journal entry.

## Blocked by

- [142 — Selection drag-to-move](142-selection-drag-to-move.md)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | Strengthened Clear Canvas and Delete Layer regression coverage for Floating Selection commit-first behavior, Marquee preservation, and two-step undo. |

### Key Decisions

- No production code change was needed because the existing destructive-action paths already committed idle Floating Selections first. The slice was completed by locking the acceptance criteria with more explicit regression coverage.
