---
title: "Deepen Floating Selection lifecycle ownership"
status: done
created: 2026-06-04
---

## What to build

Extract the web shell's transient Floating Selection lifecycle from `TabState` into a dedicated editor-session module.

Scope:

- Keep work web-shell only; no Rust core or Apple changes.
- Preserve existing Selection behavior for drag move, nudge, paste, duplicate, cancel, commit, undo, and session snapshots.
- Keep undoable persistence in the Document Change Journal.
- Let `TabState` coordinate tool effects and public tab operations without owning Floating Selection buffers directly.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/floating-selection-lifecycle.ts` | Added a lifecycle owner for transient Floating Selection lift, move, cancel, duplicate, clipboard materialization, preview compositing, and snapshot-safe source pixels. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Delegated Floating Selection state transitions to the lifecycle owner while preserving the public tab API and Journal commit boundary. |

### Key Decisions

- Chose a web-shell editor-session module because Floating Selection is transient UI/editing state rather than persisted Document state.
- Kept the Document Change Journal responsible for undoable commits; the lifecycle module only returns commit intents or calls a caller-provided commit hook.
- Kept paste destination calculation in `TabState`, while moving clipboard materialization into the lifecycle module.

### Notes

- This architecture deepening did not originate from a `tasks/todo.md` row, so there is no todo item to remove.
- `docs/platform-status.md` is unchanged because this refactor does not alter cross-platform feature status or user-facing behavior.
