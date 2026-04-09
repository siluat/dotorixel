---
title: Document persistence foundation
status: open
created: 2026-04-09
parent: 041-reopen-past-work.md
---

## What to build

Change the document lifecycle so that closing a tab no longer deletes the document from IndexedDB. This is the foundational persistence model change that all other slices depend on.

End-to-end: schema migration adds the `saved` field → persistence logic stops deleting saved documents on tab close → auto-save flushes pending changes before a saved tab closes → existing users' data is preserved through migration.

Key changes (see parent PRD "Implementation Decisions" for full context):
- IndexedDB schema v1 → v2: add `saved: boolean` to `DocumentRecord`
- Migration handler: set `saved: true` on all existing documents
- `SessionPersistence.save()`: remove orphan-deletion logic for `saved: true` documents; only delete documents that are `saved: false` and no longer in the tab list
- Fix `createdAt` overwrite bug: preserve existing `createdAt` on updates, only set on first insert
- Flush auto-save before closing a saved document's tab

## Acceptance criteria

- `DocumentRecord` includes a `saved: boolean` field
- Upgrading from DB v1 to v2 preserves all existing documents with `saved: true`
- Closing a tab for a `saved: true` document does not delete it from IndexedDB
- Closing a tab for a `saved: false` document that is no longer in any tab deletes it from IndexedDB
- `createdAt` is set only on first insert; subsequent saves preserve the original value
- Pending auto-save changes are flushed before a saved document's tab closes
- All existing session persistence tests continue to pass (with updates for new behavior)

## Blocked by

None — can start immediately.

## Scenarios addressed

- Scenario 9: Reopened saved document closes with auto-save flush, no dialog
- Scenario 12: Existing user upgrades — schema migration preserves data
