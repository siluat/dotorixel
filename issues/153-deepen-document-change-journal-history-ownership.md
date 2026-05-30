---
title: "Deepen Document Change Journal history ownership"
status: done
created: 2026-05-30
---

## What to build

Move web-shell undo/redo and clear-canvas orchestration behind the Document Change Journal so tool dispatch can stay focused on stroke lifecycle and draw state.

Scope:

- Keep the change web-shell only; no Rust core or Apple changes.
- Preserve existing drawing, clear, undo, redo, and resize-undo behavior.
- Remove the tool authoring dependency on a history port.
- Keep tools able to request snapshot timing without directly owning history.
- Keep draw-time undo/redo guards intact.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | Made the Journal own `HistoryManager`, undo/redo document replacement follow-up, canvas change follow-up, preview invalidation, and clear-active-layer mutation. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Routed draw effects, undo/redo, clear, and manual snapshot capture through the Journal while preserving public tab methods. |
| `src/lib/canvas/tool-runner.svelte.ts` | Reduced ToolRunner to tool dispatch and draw state by removing history, undo/redo, clear, and document replacement effects. |
| `src/lib/canvas/draw-tool.ts` | Added an explicit snapshot-request effect that tools can return without owning history. |
| `src/lib/canvas/tool-authoring.ts` | Converted continuous, shape, and one-shot tool sugar from direct history writes to snapshot-request effects. |
| `src/lib/canvas/stroke-engine.ts` | Removed the history dependency from stroke engine session construction. |
| `src/lib/canvas/tools/move-tool.ts` | Converted move tool snapshot timing to a snapshot-request effect. |
| `src/lib/canvas/*test.ts`, `src/lib/canvas/editor-session/*test.ts`, `src/lib/canvas/tools/*test.ts` | Updated tool, runner, stroke-engine, Journal, and TabState coverage around the new ownership boundary. |

### Key Decisions

- Chose the Document Change Journal as the owner of web-shell history because it already owns the Document mutation follow-up sequence.
- Kept tool modules responsible only for declaring when a snapshot is needed; the Journal decides how that snapshot is captured.
- Kept the WASM history adapter injected into the Journal from `TabState`, so the Journal depends on the `HistoryManager` interface rather than a concrete backend.

### Notes

- This architecture deepening did not originate from a `tasks/todo.md` row, so there is no todo item to remove.
- `docs/platform-status.md` is unchanged because this refactor does not alter cross-platform feature status or user-facing behavior.
