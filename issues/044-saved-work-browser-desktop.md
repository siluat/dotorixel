---
title: Saved work browser — desktop
status: done
created: 2026-04-09
parent: 041-reopen-past-work.md
---

## What to build

A desktop modal that lets users browse their saved documents, open them as new tabs, and delete unwanted ones. Includes the data query layer, thumbnail rendering, and the complete desktop UI.

End-to-end: trigger button in TopBar opens a modal → query fetches saved documents sorted by `updatedAt` descending, filtering out already-open tabs → thumbnails render dynamically from pixel data → selecting a card opens the document as a new tab → trash icon triggers a delete confirmation dialog → confirming deletes from IndexedDB.

Key changes (see parent PRD "Implementation Decisions" for full context):
- `SessionStorage.getAllSavedDocuments()`: query `saved: true` documents, sorted by `updatedAt` descending
- `Workspace.openDocument()`: add a saved document as a new tab in the current session
- Thumbnail renderer: pure function rendering pixel data onto a small canvas element
- Desktop modal component: centered overlay (640px per design 040), card grid, empty state
- Delete confirmation dialog with permanent deletion
- TopBar trigger button (per design 040)
- Filter: exclude documents already open as tabs

Design reference: `docs/pencil-dotorixel.pen` frame `3PXRt` (issue 040).

## Acceptance criteria

- TopBar shows a trigger button that opens the saved work browser modal
- Modal displays saved documents as cards with thumbnail, name, canvas size, and last modified date
- Documents are sorted by most recently modified first
- Documents already open as tabs are excluded from the list
- Selecting a card opens the document as a new tab and closes the modal
- Trash icon on a card opens a delete confirmation dialog
- Confirming deletion removes the document from IndexedDB and the list
- Empty state is displayed when no saved documents exist
- Modal closes on backdrop click, Escape key, or after opening a document

## Blocked by

- [042 — Document persistence foundation](042-persistence-foundation.md)

## Scenarios addressed

- Scenario 7: User opens saved work browser → sorted list, excluding open tabs
- Scenario 8: User selects a document → opens as new tab
- Scenario 10: User deletes a document → confirmation → permanent removal
- Scenario 11: No saved documents → empty state

## Results

| File | Description |
|------|-------------|
| `src/lib/session/session-storage.ts` | Added `getAllSavedDocuments()` query method |
| `src/lib/session/session-storage.test.ts` | Tests for filtering and sorting saved documents |
| `src/lib/session/session-storage-types.ts` | Added `SavedDocumentSummary` type |
| `src/lib/session/session-persistence.ts` | Passthrough for `getAllSavedDocuments()` |
| `src/lib/session/session.ts` | Extended `SessionHandle` with `getAllSavedDocuments()` |
| `src/lib/canvas/workspace.svelte.ts` | Added `openDocument()` method |
| `src/lib/canvas/workspace.svelte.test.ts` | Test for opening a saved document as a new tab |
| `src/lib/ui-editor/SavedWorkBrowser.svelte` | Desktop modal: card grid, empty state, delete confirmation, focus trap, scroll lock |
| `src/lib/ui-editor/TopBar.svelte` | Added trigger button (folder-open icon) |
| `src/lib/ui-editor/TopBar.stories.svelte` | Updated with new prop |
| `src/lib/ui-editor/SaveDialog.svelte` | Added body scroll lock on mount |
| `src/routes/editor/+page.svelte` | Wired browser open/select/delete/close handlers |
| `src/styles/design-tokens.css` | Added `--ds-font-body-sm` token (Galmuri9) |
| `messages/en.json` | Added browser and aria i18n keys |
| `messages/ko.json` | Added browser and aria i18n keys |
| `messages/ja.json` | Added browser and aria i18n keys |

### Key Decisions
- Modal is purely presentational — editor page fetches data and passes as props
- Thumbnail rendering uses Svelte action with `imageSmoothingEnabled = false` for crisp pixel art
- Tab filtering happens at open time: flush auto-save first, then exclude open tab IDs
- Delete uses two-step confirmation via separate `alertdialog` overlay

### Notes
- Galmuri9 (`--ds-font-body-sm`) introduced for dialog title and card name readability
- Body scroll lock pattern also backfilled to existing SaveDialog
