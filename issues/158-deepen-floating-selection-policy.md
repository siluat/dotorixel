---
title: "Deepen Floating Selection policy ownership"
status: done
created: 2026-06-06
---

## What to build

Move Selection-local Floating Selection policies behind the lifecycle module's interface so `TabState` no longer has to coordinate low-level commit, paste, duplicate, nudge, and Selection-drag projection order.

Scope:

- Keep work web-shell only; no Rust core or Apple changes.
- Preserve existing Floating Selection behavior for paste, duplicate, keyboard nudge, Selection drag, cancel, commit, undo, and preview rendering.
- Keep undoable persistence in the Document Change Journal.
- Keep viewport-dependent paste destination calculation in `TabState`.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/floating-selection-lifecycle.ts` | Moved paste-before-commit, duplicate sequencing, Marquee nudge auto-lift, Selection draw-start projection, and outside-drag commit policy behind the lifecycle interface. |
| `src/lib/canvas/editor-session/floating-selection-lifecycle.test.ts` | Added direct lifecycle coverage for the deepened Floating Selection policies and the commit adapter seam. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Reduced Floating Selection orchestration to tab-level guards, paste destination selection, and render invalidation. |

### Key Decisions

- Kept the Document Change Journal as the owner of undoable persistence and injected the commit adapter into the lifecycle instead of importing the Journal.
- Kept paste destination calculation in `TabState` because it depends on the tab viewport, not the Floating Selection lifecycle.
- Used lifecycle-level tests as the interface test surface so policy order is no longer only covered through broader tab/workspace tests.

### Notes

- This architecture deepening did not originate from a `tasks/todo.md` row, so there is no todo item to remove.
- `docs/platform-status.md` is unchanged because this refactor does not alter cross-platform feature status or user-facing behavior.
