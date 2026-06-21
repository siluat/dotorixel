---
title: "Per-frame duration — document schema V7 + snapshot persistence"
status: ready-for-agent
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
