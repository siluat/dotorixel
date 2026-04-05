---
title: Multi-tab session persistence
status: open
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
