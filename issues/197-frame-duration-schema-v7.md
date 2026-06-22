---
title: "Per-frame duration — document schema V7 + snapshot persistence"
status: done
created: 2026-06-21
parent: 193-per-frame-speed-control.md
---

## Parent

[193 — Per-frame speed control (per-frame duration, M4)](193-per-frame-speed-control.md)

## What to build

Persist per-frame duration so animation timing survives a refresh, bumping the
document record to **V7** with a lossless V6 → V7 migration, and flow duration
through the workspace snapshot. Depends on the WASM binding (196), since the
snapshot read/rebuild path uses it.

- Bump the document record to **V7** (`DB_VERSION` 6 → 7). The only change:
  `FrameRecord` gains a `duration` (ms) field. `frames`, `activeFrameId`, the cel
  grid, layers, and the workspace viewport/reference/display-state records are all
  unchanged.
- **V6 → V7 migration**: every existing `FrameRecord` gains
  `duration = DEFAULT_DURATION_MS` (a TS mirror of the core constant — a single
  source of truth, not a re-typed literal). Lossless; history resets, consistent
  with prior schema migrations. V5/earlier still route through the existing
  V5 → V6 step first, then V6 → V7.
- The workspace **snapshot already carries `readonly FrameRecord[]`**, so once
  `FrameRecord` has `duration` the snapshot transports it. Two call sites do the
  real work:
  - `toSnapshot` reads each frame's duration from `frames_metadata().duration_ms`
    into the snapshot's `FrameRecord`s.
  - `documentFromLayerSource` applies each frame's duration on rebuild via
    `set_frame_duration` (after the frame exists); legacy single-buffer sources
    build one frame at the default.
- `save` / `restore` carry duration through end-to-end.

## Acceptance criteria

- A V7 document serializes → deserializes round-trip, preserving every frame's
  `duration` exactly.
- A V6 document (and earlier, via the existing chain) migrates to V7 with every
  frame at `DEFAULT_DURATION_MS`, no pixel or structure loss; `frames` /
  `activeFrameId` / cels unchanged.
- An existing saved animation opens with default durations, invisibly to the user.
- Duration survives a snapshot → Document → snapshot round-trip (TabState) and a
  `save` → `restore` round-trip (session persistence).
- Reopening saved work and duplicating a tab carry durations through.
- `DB_VERSION` is 7 and the V6 → V7 DB-open upgrade path is covered by a test.
- The TS default duration references a single mirror of the core constant.

## Blocked by

- [196 — Per-frame duration WASM binding + journal intent + TabState](196-frame-duration-wasm-journal.md)

Unblocks 198.

## Results

| File | Description |
|------|-------------|
| `src/lib/session/session-storage-types.ts` | `DocumentSchemaV7` + `FrameRecord.durationMs`; froze the V6 frame shape as `FrameRecordV6`; `migrateV6ToV7` backfills the default duration; `DEFAULT_FRAME_DURATION_MS` single TS mirror of the core constant |
| `src/lib/session/session-storage.ts` | `DB_VERSION` 6→7; `normalizeToV7` read-path chain; `oldVersion < 7` DB-open upgrade cursor (defensive try/catch) |
| `src/lib/session/session-persistence.ts` | `save` writes V7; `getSavedDocumentSnapshot` / `restore` carry `durationMs` end-to-end |
| `src/lib/canvas/wasm-backend.ts` | `applyFrameDurations` applies each frame's duration on rebuild via `set_frame_duration` (positional alignment; single- and multi-frame) |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `toSnapshot` reads `frames_metadata().duration_ms` into the snapshot frames |
| `src/lib/canvas/workspace-snapshot-fixtures.ts` | fixture frames carry `durationMs` (+ optional `frameDurationsMs` override for round-trip tests) |
| tests | `migrateV6ToV7`, V6→V7 + V1→V7 DB-open upgrade, hydration duration, `toSnapshot`, save/restore + reopen round-trips |

### Key Decisions
- **Field is `durationMs`, not the issue text's `duration`.** The codebase already standardizes on `durationMs` (journal `set-frame-duration` intent, `setFrameDuration(id, durationMs)`) and `duration_ms` (core/WASM); the bare name broke that vocabulary and needed a "in milliseconds" comment — the exact Naming-guide anti-pattern.
- **`durationMs` is required, not optional.** Every construction site carries it (type-enforced); the V6→V7 migration is the single place that backfills the default. The duration-less V6 shape is frozen as `FrameRecordV6` so the migration input stays type-honest (sets the value, never copies an absent one).
- **No WASM/Rust changes.** The binding and the 1–60000ms clamp shipped in 196; this slice is web-shell schema/persistence only.

### Notes
- The duration clamp stays single-sourced at the WASM boundary; the schema trusts persisted values.
- 198 (TimelinePanel control + i18n + E2E) is now unblocked — the last remaining slice of PRD 193.
