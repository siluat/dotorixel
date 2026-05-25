---
title: "Deepen Document change procedure into a Document Change Journal"
status: done
created: 2026-05-25
---

## What to build

Extract the first slice of the web shell's Document change procedure from `TabState` into a dedicated `Document Change Journal` Module.

Scope:

- Keep work web-shell only; no Rust core or Apple changes.
- Introduce **Document Change Journal** as the domain term in `CONTEXT.md`.
- Preserve the Rust core `Document` as the authority for Document invariants.
- Migrate only the `addLayer` path as the tracer bullet.
- Centralize the shell-side follow-up sequence around undo snapshot capture, canvas dimension mirrors, viewport reclamp, render invalidation, and dirty notification.
- Leave async persistence rollback receipts out of scope.

## Acceptance Criteria

- `addLayer` applies its Document mutation through a `Document Change Journal`.
- The Journal captures an undo snapshot before the core mutation and runs follow-up effects only after a successful mutation.
- Existing add-layer behavior remains undoable and still invalidates rendering and dirty state.
- Tests cover the Journal sequence and the failure path where core mutation errors skip follow-up effects.
- Domain vocabulary names Document Change Journal explicitly and distinguishes it from Rust core Document invariants.

## Results

| File | Description |
|------|-------------|
| `CONTEXT.md` | Added the Document Change Journal domain term, its relationship to Document, and vocabulary to avoid. |
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | Added the web-shell Journal Module for classified Document changes and shell-side follow-up sequencing. |
| `src/lib/canvas/editor-session/document-change-journal.test.ts` | Covered the add-pixel-layer sequence and the failed core-mutation path. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Routed `addLayer` through the Journal while preserving the existing TabState public API. |

### Key Decisions

- Chose a web-shell `editor-session` Module instead of moving orchestration into Rust core because the Journal owns shell follow-up effects, not Document invariants.
- Kept the first implementation to the `addLayer` tracer bullet so the new seam proves its value without migrating every Document mutation at once.
- Treated active Layer changes as persisted UI state, not undoable artwork state.
- Left async persistence rollback receipts out of this slice.

### Notes

- `docs/platform-status.md` is unchanged because this refactor does not alter cross-platform feature status or user-facing behavior.
- The completed task was created from an architecture deepening session rather than an existing `tasks/todo.md` item, so there was no todo row to remove.
