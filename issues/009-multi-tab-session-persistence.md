---
title: Multi-tab session persistence
status: done
created: 2026-04-06
parent: 007-session-persistence.md
---

## What to build

Extend session persistence to handle multiple tabs. When the user has several canvases open in different tabs, all of them should be saved and restored with correct names, order, pixel data, and the same active tab selected.

The SessionStorage `documents` store already supports multiple records (from issue 008). This slice extends SessionPersistence to save/restore all tabs (not just the first), stores the tab order and active tab index in the `workspace` record, and extends Workspace initialization to accept multiple tabs.

## Acceptance criteria

- [ ] SessionPersistence saves all open tabs as separate document records
- [ ] Workspace metadata includes ordered list of document IDs and active tab index
- [ ] Restore reconstructs all tabs in the correct order with the correct active tab
- [ ] Closing a tab removes its document record from the session
- [ ] Adding a new tab persists it on the next save cycle
- [ ] SessionPersistence multi-tab round-trip tested
- [ ] Workspace multi-tab initialization tested

## Blocked by

- [008 — Single-tab session save & restore](008-single-tab-session-save-restore.md)

## Scenarios addressed

- Scenario 2: 3 tabs open → close browser → all 3 restored with names, order, and active tab

## Results

| File | Description |
|------|-------------|
| `src/lib/session/session-persistence.ts` | `save()` iterates all `workspace.tabs` instead of only `activeEditor`; ID generation changed to `crypto.randomUUID()` |
| `src/lib/session/session-persistence.test.ts` | 4 new multi-tab tests added, 1 single-tab-only test replaced |

### Key Decisions
- No type or interface changes needed — `WorkspaceRecord`, `WorkspaceInit`, and `restore()` already supported multiple tabs from issue 008
- Switched doc ID generation from `Date.now()` to `crypto.randomUUID()` to prevent ID collision when saves occur within the same millisecond

### Notes
- `restore()` was not modified — it already iterated `tabOrder` for multiple documents
- Cleanup logic simplified: since UUIDs are unique, old doc IDs are unconditionally deleted without checking against new IDs
