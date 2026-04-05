---
title: Single-tab session save & restore
status: open
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
