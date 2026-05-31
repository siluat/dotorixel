---
title: "Marquee persistence — Document storage v4 → v5 migration"
status: done
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

Persist the Marquee with the Document so it survives reload and tab switching. Document storage moves from v4 to v5.

Scope:

- Bump the Document storage schema version from v4 to v5.
- v5 record carries an optional `marquee: { x, y, width, height } | null` field.
- Migration: existing v4 documents hydrate with `marquee: null` (no Marquee).
- Re-hydration: when a document loads with a non-null marquee, the resulting `Document.marquee()` returns the same region.
- Auto-save: marquee changes flow through the existing debounced auto-save (the journal already calls `markDirty()` on `set-marquee`).
- Cross-tab: switching to another tab and back preserves the Marquee in the tab's Document.

Implementation notes:

- v5 migration logic in the persistence module (parallel to existing v3 → v4 migration for Reference Layer per PRD-105).
- The `MarqueeRegion` clipping rules already in 132 mean the loaded marquee is always valid against the loaded canvas size.

## Acceptance criteria

- A document created in v4 (pre-Selection) loads under v5 without error and with `marquee: null`.
- A document with a Marquee saved, reloaded, has the same Marquee in `Document.marquee()`.
- Switching tabs and returning preserves the Marquee.
- IndexedDB schema version reflects v5.
- Migration test: v4 fixture → v5 hydration produces correct shape.
- Round-trip test: save → reload → marquee identity holds.

## Blocked by

- [132 — Selection foundation](132-selection-foundation.md)

## Results

| File | Description |
|------|-------------|
| `src/lib/session/session-storage-types.ts` | Added Document schema v5 with persisted Marquee data and v4→v5 migration. |
| `src/lib/session/session-storage.ts` | Bumped IndexedDB to v5 and normalized legacy documents to the current schema. |
| `src/lib/session/session-persistence.ts` | Saved and restored tab Marquee data through document persistence. |
| `src/lib/canvas/workspace-snapshot.ts` | Added optional Marquee data to tab snapshots. |
| `src/lib/canvas/wasm-backend.ts` | Hydrated persisted Marquee data into the WASM Document, clipping stale bounds to the loaded canvas. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Serialized the active Document Marquee into workspace snapshots. |
| `src/lib/session/*.test.ts`, `src/lib/canvas/editor-session/workspace.svelte.test.ts` | Covered v4→v5 migration, save→restore round-trip, reload hydration, tab switching, and stale-bound clipping. |

### Key Decisions

- Persisted the Marquee as Document v5 data rather than workspace state because the Marquee is document-scoped and follows the Document across reloads and tab switches.
- Clipped persisted Marquee bounds during hydration so documents resized before reload cannot restore an out-of-canvas Marquee.

### Notes

- A persisted Marquee that no longer overlaps the loaded canvas is cleared on hydration.
