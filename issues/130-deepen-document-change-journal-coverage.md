---
title: "Deepen Document Change Journal coverage beyond add-layer"
status: done
created: 2026-05-25
---

## What to build

Deepen the web shell's Document Change Journal beyond the first add-layer tracer bullet so it owns the common Document mutation follow-up sequence for more Layer and Reference Layer paths.

Scope:

- Keep work web-shell only; no Rust core or Apple changes.
- Preserve the existing `TabState` public calls used by UI code.
- Route undoable Document changes through the Journal when they share the same snapshot, viewport reclamp, render invalidation, and dirty notification sequence.
- Route persisted Document UI state changes through the Journal without pushing undo snapshots.
- Keep tool drawing lifecycle and async persistence rollback outside this slice.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | Expanded the Journal to classify undoable Document changes and persisted Document UI changes, including no-op detection and shared follow-up effects. |
| `src/lib/canvas/editor-session/document-change-journal.test.ts` | Added direct Journal coverage for no-op changes, persisted UI state changes, Reference Layer source validation, Reference Layer blob retention, and resize adapter routing. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Routed Layer, Reference Layer, resize, and persisted timeline-panel changes through the Journal while preserving existing public methods. |

### Key Decisions

- Treated the Journal's depth as "classified Document change procedure" rather than "undo wrapper," so active Layer and timeline collapsed changes go through the same seam without adding undo snapshots.
- Kept `ToolRunner` as the owner of drawing and undo/redo lifecycles; the Journal only absorbs Document changes that already share the shell follow-up sequence.
- Left Reference Layer import dialog state and async persistence rollback outside the Journal because they involve UI flow and storage recovery rather than the core Document mutation sequence.

### Notes

- This is an architecture deepening follow-up to issue 129; it did not originate from a `tasks/todo.md` row, so there is no todo item to remove.
- `docs/platform-status.md` is unchanged because no cross-platform user-facing feature status changed.
