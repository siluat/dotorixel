---
title: "Per-frame duration — Rust core (Frame.duration_ms + set_frame_duration)"
status: done
created: 2026-06-21
parent: 193-per-frame-speed-control.md
---

## Parent

[193 — Per-frame speed control (per-frame duration, M4)](193-per-frame-speed-control.md)

## What to build

The Rust-core slice of PRD 193: give every **Frame a duration in milliseconds**,
the source of truth for animation timing. No shell consumer yet — this lands
dead-code-tolerant, exactly as the frame cel-grid core slice (188) did.

- `Frame` gains a `duration_ms` field, staying a small `Copy` value type
  (`Frame { id, duration_ms }`).
- A single named constant `Frame::DEFAULT_DURATION_MS` (= 100, i.e. 10 fps) is the
  one source of truth for "default duration"; `Frame::INITIAL` carries it.
- **Identity stays id-based**: duration is mutable metadata, not identity — a
  retimed frame is the same frame. `Frame` equality/hash must key on `id` only
  (implement on `id`, or drop the now-ambiguous derives if no by-value use
  remains). The cel store is keyed by frame `Uuid`, so the grid invariant is
  unaffected.
- New `Document::set_frame_duration(frame_id, duration_ms)` — updates the frame's
  duration; returns `FrameError::FrameNotFound` for an unknown id. Mirrors the
  existing UUID-keyed frame ops. The core **trusts** its input value (range
  clamping is a boundary concern handled in 196, per "fail at the boundary").
- `add_frame` seeds the new frame at `DEFAULT_DURATION_MS`; `duplicate_frame`
  copies the source frame's `duration_ms`. `remove_frame` / `reorder_frame` carry
  durations untouched (they move/drop whole `Frame`s).
- CONTEXT.md's **Frame** entry is updated: drop "or duration"; note a Frame now
  carries a duration (display time, ms) that is **mutable metadata, not identity**;
  it stays nameless/counterless (displayed as its 1-based ordinal).

## Acceptance criteria

- `Document::new` and `add_frame` produce frames at `DEFAULT_DURATION_MS`.
- `duplicate_frame` copies the source frame's duration.
- `set_frame_duration` updates the target frame's duration; an unknown id returns
  `FrameError::FrameNotFound`.
- `remove_frame` / `reorder_frame` leave other frames' durations intact and
  preserve a moved frame's duration by id.
- `Frame` equality/hash is id-based (a retimed frame is equal by identity); the
  grid invariant holds after every mutation.
- Inline Rust unit tests assert external behavior via `frames()` metadata reads —
  never a private field.
- Existing single-frame behavior is unchanged; all prior core tests still pass.
- CONTEXT.md's Frame entry is updated as described.

## Blocked by

None — can start immediately (runs in parallel with 194). Unblocks 196.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/frame.rs` | `Frame` gains `duration_ms: u32` and `DEFAULT_DURATION_MS` (100 ms = 10 fps); `INITIAL` carries the default. `PartialEq`/`Eq`/`Hash` are now hand-written, keyed on `id` alone (derives dropped). |
| `crates/core/src/document.rs` | New `set_frame_duration(id, ms)` (returns `FrameNotFound` for unknown id); `add_frame` seeds the default, `duplicate_frame` copies the source frame's duration; `remove_frame`/`reorder_frame` carry durations untouched. +9 inline behavior tests. |
| `CONTEXT.md` | Frame entry: drops "or duration"; notes a Frame now carries a duration (display time, ms) that is **mutable metadata, not identity**. |

### Key Decisions

- **Frame equality/hash: manual impl keyed on `id`** (rather than dropping the
  derives). The acceptance criterion requires "a retimed frame is equal by
  identity" to be a *testable* behavior, which a two-field derive cannot satisfy —
  so `PartialEq`/`Eq`/`Hash` ignore `duration_ms` and key on `id` alone. (HITL
  decision.)
- **`duration_ms: u32`, not `NonZeroU32`/a clamped newtype.** The 1–60000 ms range
  is a boundary concern owned by 196; the core trusts the value, so a
  range-enforcing type here would contradict "fail at the boundary, trust the
  core."

### Notes

- Lands **dead-code-tolerant**: no shell consumer yet, so the wasm/apple binding
  crates build unchanged. **196 is now unblocked** — it wires the WASM binding +
  journal intent + TabState and owns the range clamping.
- All 455 core tests pass; `cargo fmt` clean; no new clippy/rustdoc warnings.
  Pre-existing warnings in `pixel_perfect.rs`/`tool.rs`/layer docs were left
  untouched (out of scope).
