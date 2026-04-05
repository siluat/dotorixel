---
title: Single-tab session save & restore
status: done
created: 2026-04-06
parent: 007-session-persistence.md
---

## What to build

The tracer bullet for session persistence: cut through every layer to make a single tab survive a page refresh. Add the `idb` dependency, create the SessionStorage module (full IndexedDB schema with `documents` and `workspace` stores), create the SessionPersistence module (save and restore logic), extend Workspace to accept saved initialization data, and wire it all up in the editor page.

On page load, the editor reads IndexedDB. If a valid session exists, it restores the canvas pixels, canvas size, tab name, viewport (zoom/pan/grid), and shared state (active tool, FG/BG colors, recent colors). If no data exists or restoration fails, the editor falls back to the current default (blank 16×16 canvas).

Saving is triggered by `beforeunload` for this slice — debounced auto-save comes in a later issue.

Refer to the parent PRD for full storage schema, module boundaries, and serialization approach.

## Acceptance criteria

- [ ] `idb` added as a dependency
- [ ] SessionStorage module: opens database, creates both stores with correct schema, provides typed CRUD methods
- [ ] SessionPersistence module: extracts state from Workspace/EditorState/SharedState, saves to SessionStorage, restores and reconstructs Workspace from saved data
- [ ] Workspace accepts optional initialization data (canvas pixels, size, name, viewport, shared state) instead of always creating a blank canvas
- [ ] Editor page calls restore on mount and save on beforeunload
- [ ] Corrupted or missing data falls back to default blank canvas without error
- [ ] Undo/redo history is not persisted — fresh stack after restore
- [ ] SessionStorage tested with `fake-indexeddb`: document CRUD, workspace metadata CRUD, binary data (Uint8Array) round-trip
- [ ] SessionPersistence tested: save/restore round-trip, fallback on missing/corrupted data
- [ ] Workspace initialization from saved data tested

## Blocked by

None — can start immediately.

## Scenarios addressed

- Scenario 1: draw → refresh → canvas content, tab name, and viewport restored
- Scenario 3: change tool and color → refresh → preserved
- Scenario 4: zoom into area → refresh → zoom/pan restored
- Scenario 6: corrupted data → fallback to blank canvas
- Scenario 8: Ctrl+Z after refresh → nothing (no undo history persisted)

## Results

| File | Description |
|------|-------------|
| `src/lib/session/session-storage-types.ts` | DocumentRecord, WorkspaceRecord, ViewportRecord, SharedStateRecord type definitions |
| `src/lib/session/session-storage.ts` | IndexedDB wrapper — open, document CRUD, workspace CRUD |
| `src/lib/session/session-storage.test.ts` | 5 tests: document round-trip, delete, missing record; workspace round-trip, missing record |
| `src/lib/session/workspace-init-types.ts` | WorkspaceInit, TabInit, ViewportInit, SharedStateInit type definitions |
| `src/lib/session/session-persistence.ts` | Save/restore orchestration — extracts state from Workspace, writes to SessionStorage |
| `src/lib/session/session-persistence.test.ts` | 5 tests: round-trip, multi-tab save normalizes to single tab, activeTabIndex clamping, missing data fallback, corrupted data fallback |
| `src/lib/canvas/workspace.svelte.ts` | Added `init` option for restore; replaced monotonic name counter with gap-filling `#nextUntitledName()` |
| `src/lib/canvas/workspace.svelte.test.ts` | 4 new tests: init with tab/canvas data, init with shared state, no duplicate names after restore, gap-filling tab names |
| `src/lib/canvas/editor-state.svelte.ts` | EditorOptions extended with optional `pixelCanvas` and `viewportState` for dependency injection |
| `src/routes/editor/+page.svelte` | Session restore on mount, save on beforeunload |
| `package.json` | Added `idb` (runtime), `fake-indexeddb` (dev) |

### Key Decisions

- Single-tab save stores only the active editor's data with `activeTabIndex: 0`, not the full multi-tab workspace. Multi-tab persistence is deferred to issue 009.
- Tab name counter replaced with dynamic gap-filling: `#nextUntitledName()` scans existing tab names and picks the smallest unused number. This prevents ever-growing "Untitled N" numbers across sessions.
- Viewport restore skips `handleFit()` by pre-registering restored editors in the `fittedEditors` WeakSet, preserving the user's exact zoom/pan state.
- Old documents are cleaned up after each save to prevent orphaned records from accumulating in IndexedDB.

### Notes

- `restore()` clamps `activeTabIndex` to the valid range as a defensive measure against corrupted data, independent of the save-side fix.
- The `beforeunload` handler calls `persistence.save()` without awaiting — the browser completes already-started IndexedDB transactions after page unload.
- `idb` library's `DBSchema` generic provides compile-time type safety for all store operations.
