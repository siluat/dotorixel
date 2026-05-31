---
title: "Saved work browser: reopen layered documents without flattening"
status: done
created: 2026-05-31
---

## What to build

Fix a regression where a saved multi-layer document reopened from the saved work browser became a single flattened layer. The browser cards may keep using composite thumbnail pixels, but selecting a saved document must load the full persisted document record and hydrate the complete layer stack.

## Acceptance criteria

- Saved documents with two or more Pixel Layers reopen with the same layer count, layer order, active layer, next layer number, timeline panel collapse state, and per-layer pixels.
- Saved work browser thumbnails remain composite summaries and do not load full layer stacks for browsing.
- Repeated clicks while a saved document is being loaded do not open duplicate tabs for the same document.

## Results

| File | Description |
|------|-------------|
| `src/lib/session/session-persistence.ts` | Added a full saved-document snapshot loader for reopening saved documents without using thumbnail pixels. |
| `src/lib/session/session.ts` | Exposed the saved-document snapshot loader through the session handle. |
| `src/lib/canvas/editor-session/workspace.svelte.ts` | Added full tab-snapshot opening and reused Reference Layer blob extraction with workspace hydration. |
| `src/routes/editor/+page.svelte` | Rewired saved work selection to open the full snapshot and guarded against duplicate async opens. |
| `src/lib/session/session-persistence.test.ts` | Added regression coverage for reopening a saved multi-layer document with all layer data intact. |
| `src/lib/canvas/editor-session/workspace.svelte.test.ts` | Added regression coverage for opening a full tab snapshot without flattening. |

### Key Decisions

- `SavedDocumentSummary` stays thumbnail-only so browsing saved work does not load every layer for every card.
- Opening a saved document now performs a second lookup by document ID and hydrates the full persisted `TabSnapshot`.
- The page-level open guard rejects duplicate selections while the asynchronous document lookup is pending.

### Notes

- This was a user-reported regression and was not present as a `tasks/todo.md` item, so there was no todo row to remove.
