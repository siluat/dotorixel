---
title: Reopen past work — browse and restore from saved work list
status: done
created: 2026-04-09
---

## Problem Statement

When a user closes a tab, the document is permanently deleted from IndexedDB. There is no way to revisit or reopen past work. Users who accidentally close a tab or want to return to a previous piece lose their work entirely. The editor lacks a "saved work" concept — persistence exists only for session restoration, not for long-term document storage.

## Solution

Introduce a persistent document storage model where closing a tab no longer deletes the document. Users can explicitly save documents on first close, browse their saved work through a dedicated UI, and reopen past documents as new tabs. A saved work browser (desktop modal / mobile bottom sheet) provides access to all saved documents with thumbnails, metadata, and delete capability.

## Key Scenarios

1. User creates a new document, draws on it, then closes the tab → a save dialog appears with the document name pre-filled ("Untitled N"), offering "Save" / "Delete" / "Cancel" options.
2. User selects "Save" in the save dialog → the document is marked as saved (`saved: true`) in IndexedDB with the entered name, and the tab closes.
3. User selects "Delete" (or equivalent wording that clearly communicates deletion) in the save dialog → the document is permanently removed from IndexedDB, and the tab closes.
4. User selects "Cancel" in the save dialog → the dialog closes and the tab remains open.
5. User creates a new document, does not draw anything, then closes the tab → the tab closes immediately without a dialog, and the document is removed from IndexedDB.
6. User draws on a new canvas, undoes all strokes back to the initial blank state, then closes the tab → treated as a blank canvas; the tab closes without a dialog.
7. User opens the saved work browser → a list of saved documents appears, sorted by most recently modified, excluding documents that are already open as tabs.
8. User selects a document in the saved work browser → the document opens as a new tab in the current session. The browser closes.
9. User reopens a previously saved document, modifies it, then closes the tab → the latest state is auto-saved (flushed on close) and the tab closes without a dialog.
10. User clicks the trash icon on a card in the saved work browser → a delete confirmation dialog appears. Confirming deletes the document permanently from IndexedDB.
11. User opens the saved work browser but has no saved documents → an empty state is displayed with guidance.
12. Existing user upgrades to the new version → schema migration sets `saved: true` on all existing documents; no disruption to their session.

## Implementation Decisions

- **Document lifecycle change**: `SessionPersistence.save()` will no longer delete documents that are removed from the tab list. Instead, deletion only happens explicitly — via the save dialog ("Delete") or the saved work browser delete action.
- **`saved` field on `DocumentRecord`**: A `saved: boolean` field is added. `false` = new document that has not been explicitly saved yet. `true` = user chose to save. The saved work browser only lists documents with `saved: true` that are not in the current tab list.
- **IndexedDB schema migration (v1 → v2)**: The `upgrade` handler iterates existing documents and sets `saved: true`. This preserves all existing user data without disruption.
- **`createdAt` bug fix**: Currently `createdAt` is overwritten on every auto-save. Fix: only set `createdAt` when a document is first inserted; preserve the existing value on updates.
- **Blank canvas detection**: A pure function compares the current pixel data against the initial background state. If all pixels match the initial color, the canvas is blank. This check uses pixel state only — undo history is not considered.
- **Save dialog**: Appears only on the first close of a new document (`saved: false`) with non-blank content. Three actions: "Save" (set `saved: true`, apply name, close tab), "Delete" (remove from IndexedDB, close tab — button text must clearly communicate that deletion occurs), "Cancel" (dismiss dialog, keep tab open). Includes a name input field pre-filled with the current document name.
- **Re-close of saved documents**: When a document with `saved: true` is closed, auto-save flushes any pending changes and the tab closes immediately. No dialog.
- **Open action**: Opening a document from the saved work browser adds it as a new tab in the current session. The same IndexedDB record is reused, so auto-save continues to update it seamlessly.
- **Thumbnails**: Generated dynamically when the saved work browser is opened, by rendering pixel data onto a small `<canvas>` element. No pre-generated thumbnails are stored. Pixel art resolution is small enough that this is effectively instant.
- **Sort order**: Documents are listed by `updatedAt` descending (most recently modified first). No user-configurable sorting in this version.
- **UI pattern**: Desktop uses a centered modal overlay (640px, per design 040). Mobile uses a bottom sheet (vaul-svelte, per design 040). Responsive branching follows the existing layout mode system (`isDocked`).
- **Trigger button**: Placed in TopBar (desktop) and AppBar (mobile), per design 040.
- **Delete from browser**: Single-item deletion only. Trash icon on each card → confirmation dialog → permanent removal from IndexedDB.

## Testing Decisions

Tests should verify external behavior through public interfaces, not internal implementation details. Existing session persistence tests provide the pattern to follow.

**Modules to test:**

- **SessionStorage schema migration**: Verify that upgrading from v1 to v2 preserves all existing documents with `saved: true` and that the new `saved` field is correctly persisted on reads/writes.
- **SessionPersistence — no orphan deletion**: Verify that closing a tab (removing from snapshot) no longer deletes the document from IndexedDB. Verify that documents with `saved: false` and not in the tab list are cleaned up.
- **SessionPersistence — `createdAt` preservation**: Verify that `createdAt` is set only on first insert and preserved on subsequent saves.
- **Blank canvas detection**: Test boundary conditions — 1×1 canvas, various background colors, partially drawn then fully erased, single pixel different from background.
- **Thumbnail renderer**: Verify that pixel data is correctly rendered to an image representation at the expected dimensions.

## Rejected Alternatives

- **Hide instead of delete on "Don't Save"**: Keeping hidden data that the user explicitly chose not to save violates user expectations and adds storage/complexity for no benefit. The three-option dialog (Save/Delete/Cancel) provides sufficient protection against accidental loss.
- **Session replacement on open**: Opening a saved document could replace the entire current session instead of adding a tab. Rejected because it conflicts with the multi-tab workflow (M2 milestone goal) and risks closing unsaved work.
- **Pre-generated thumbnails**: Storing thumbnail images alongside documents in IndexedDB was considered. Rejected because pixel art canvases are small enough to render dynamically without perceptible delay, and pre-generation would add complexity to every auto-save cycle.
- **Sortable/searchable document list**: Adding sort options and search/filter was considered. Rejected for MVP — a fixed most-recently-modified order is sufficient, and the feature can be added later if document counts grow.
- **Multi-select deletion**: Batch selection and deletion from the saved work browser was considered. Rejected for MVP — single-item deletion with confirmation is safer and simpler.
- **Document rename from browser**: Allowing inline name editing in the saved work browser was considered. Deferred because tab-level rename doesn't exist yet either; both should be designed together.

## Out of Scope

- **IndexedDB quota exceeded handling**: Auto-save already silently fails on storage quota errors. This is a pre-existing issue tracked separately in the review backlog, not specific to this feature.
- **Document rename**: Neither from the saved work browser nor from the tab. Tracked separately in the review backlog.
- **Storage limits or cleanup**: No maximum document count or storage warnings. Pixel art documents are small (256×256 RGBA ≈ 256KB); accumulation is unlikely to hit browser quotas in normal use.
- **Cross-tab synchronization**: Multiple browser tabs sharing the same IndexedDB remain last-write-wins. No change from current behavior.
- **Export from browser**: Exporting a saved document directly from the browser without opening it first.

## Further Notes

- Design reference: `docs/pencil-dotorixel.pen` frame `3PXRt` (issue 040) contains the UI mockups for the saved work browser — desktop modal, mobile bottom sheet, empty states, delete confirmation dialog, and trigger button placement.
- The `documents` object store already has an `updatedAt` index, which supports the sort order without schema changes beyond the `saved` field addition.
