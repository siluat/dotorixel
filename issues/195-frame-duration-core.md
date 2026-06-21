---
title: "Per-frame duration — Rust core (Frame.duration_ms + set_frame_duration)"
status: ready-for-agent
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
