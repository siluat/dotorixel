---
title: Debounced auto-save with dirty tracking
status: done
created: 2026-04-06
parent: 007-session-persistence.md
---

## What to build

Replace the beforeunload-only saving (from issue 008) with proactive auto-save. Track which tabs have changed since the last save (dirty flags), and flush dirty data to IndexedDB after a debounce interval (3–5 seconds of inactivity). Keep `beforeunload` and `visibilitychange` as safety nets for immediate save when the page is closing or becoming hidden.

This ensures that work is preserved even if the browser crashes or the mobile app is killed (no unload event fires). Only dirty documents are written, avoiding unnecessary IndexedDB writes for unchanged tabs.

The last-write-wins behavior for multiple browser tabs (PRD scenario 7) is a natural consequence of this design — no special handling needed.

## Acceptance criteria

- [x] Dirty flag set when canvas changes (draw, resize, clear) or workspace structure changes (tab add/close/reorder)
- [x] Debounce timer flushes dirty data to IndexedDB after 3–5 seconds of no new changes
- [x] Only dirty documents are written — unchanged tabs are skipped
- [x] `beforeunload` triggers immediate save (flushes pending dirty data)
- [x] `visibilitychange` (hidden) triggers immediate save for mobile Safari coverage
- [x] Multiple rapid changes within the debounce window result in a single write
- [x] Dirty tracking tested: flag set on change, cleared after save
- [x] Debounce behavior tested: rapid changes batched, timer reset on new change

## Results

| File | Description |
|------|-------------|
| `src/lib/session/auto-save.ts` | AutoSave class — debounce timer, per-document dirty tracking, flush for safety nets |
| `src/lib/session/auto-save.test.ts` | 7 behavior tests covering debounce, batching, flush, selective save, cleanup |
| `src/lib/session/session-persistence.ts` | Switched to stable document IDs; added optional `dirtyDocIds` for selective writes |
| `src/lib/session/session-persistence.test.ts` | Updated cleanup test to match stable ID semantics; added removed-tab cleanup test |
| `src/lib/canvas/editor-state.svelte.ts` | Added `documentId` field (auto-generated UUID, preserved on restore) |
| `src/lib/canvas/workspace.svelte.ts` | Passes restored `documentId` through to EditorState |
| `src/routes/editor/+page.svelte` | Integrated AutoSave; `$effect` watches `renderVersion` per editor for dirty detection |

### Key Decisions

- Stable document IDs instead of regenerating UUIDs on every save — enables per-document selective writes via IndexedDB `put()` upsert
- Canvas change detection via `$effect` watching `renderVersion` with a per-editor `Map` to avoid false positives on tab switches
- `flush()` tracks in-flight save promises (`#pendingSave`) to properly synchronize with async saves triggered by debounce timers

## Blocked by

- [008 — Single-tab session save & restore](008-single-tab-session-save-restore.md)

## Scenarios addressed

- Scenario 5: refresh immediately after drawing → beforeunload/visibilitychange saves latest state
- Scenario 7: two browser tabs → last-write-wins (last to save overwrites)
