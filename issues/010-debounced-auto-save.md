---
title: Debounced auto-save with dirty tracking
status: open
created: 2026-04-06
parent: 007-session-persistence.md
---

## What to build

Replace the beforeunload-only saving (from issue 008) with proactive auto-save. Track which tabs have changed since the last save (dirty flags), and flush dirty data to IndexedDB after a debounce interval (3–5 seconds of inactivity). Keep `beforeunload` and `visibilitychange` as safety nets for immediate save when the page is closing or becoming hidden.

This ensures that work is preserved even if the browser crashes or the mobile app is killed (no unload event fires). Only dirty documents are written, avoiding unnecessary IndexedDB writes for unchanged tabs.

The last-write-wins behavior for multiple browser tabs (PRD scenario 7) is a natural consequence of this design — no special handling needed.

## Acceptance criteria

- [ ] Dirty flag set when canvas changes (draw, resize, clear) or workspace structure changes (tab add/close/reorder)
- [ ] Debounce timer flushes dirty data to IndexedDB after 3–5 seconds of no new changes
- [ ] Only dirty documents are written — unchanged tabs are skipped
- [ ] `beforeunload` triggers immediate save (flushes pending dirty data)
- [ ] `visibilitychange` (hidden) triggers immediate save for mobile Safari coverage
- [ ] Multiple rapid changes within the debounce window result in a single write
- [ ] Dirty tracking tested: flag set on change, cleared after save
- [ ] Debounce behavior tested: rapid changes batched, timer reset on new change

## Blocked by

- [008 — Single-tab session save & restore](008-single-tab-session-save-restore.md)

## Scenarios addressed

- Scenario 5: refresh immediately after drawing → beforeunload/visibilitychange saves latest state
- Scenario 7: two browser tabs → last-write-wins (last to save overwrites)
