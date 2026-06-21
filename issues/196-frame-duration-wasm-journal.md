---
title: "Per-frame duration — WASM binding + journal intent + TabState"
status: ready-for-agent
created: 2026-06-21
parent: 193-per-frame-speed-control.md
---

## Parent

[193 — Per-frame speed control (per-frame duration, M4)](193-per-frame-speed-control.md)

## What to build

Expose the core per-frame duration (195) to the web shell through the WASM
`Document` binding and route duration edits through the existing
`DocumentChangeJournal` seam, exactly as the frame operations did in 189. No
persistence (197) and no UI (198) yet — verifiable through WASM / journal /
TabState unit tests.

- `WasmFrameMetadata` gains a `duration_ms` getter — filling the seam its own doc
  comment reserved. `frames_metadata()` now carries `{ id, duration_ms }` per
  frame; the TS `FrameMetadata` interface, the `Document` facade, and the
  `Document` fake gain the matching field/method.
- New `WasmDocument::set_frame_duration(id, duration_ms)` — parses the UUID,
  **clamps `duration_ms` to `[1, 60_000]` at the boundary**, delegates to the
  core. Errors only on an invalid UUID / unknown frame (clamping never errors).
- New **undoable** document intent `set-frame-duration { id, durationMs }`,
  flowing through the established snapshot → apply → after-mutation pipeline (push
  history, mutate WASM document, invalidate-render + mark-dirty). It does **not**
  reclamp the viewport (timing changes neither dimensions nor the active layer).
- **No-op guard**: the intent skips history when the target frame's current
  duration already equals the requested value (mirrors `set-layer-visibility`).
- **Coalescing contract**: one committed duration adjustment is one undo step —
  the intent fires on commit, not per intermediate value.
- `TabState` gains a `setFrameDuration(id, durationMs)` dispatch alongside the
  existing frame methods.

## Acceptance criteria

- `frames_metadata()` returns each frame's `duration_ms`.
- `set_frame_duration` round-trips through `frames_metadata()`; out-of-range values
  clamp to `[1, 60_000]`; an invalid UUID / unknown frame errors.
- The `set-frame-duration` intent is undoable: it pushes one history entry and
  marks dirty; undo restores the prior duration and redo re-applies.
- `set-frame-duration` is a no-op (no history push) when the value is unchanged.
- `set-active-frame` remains non-undoable.
- `TabState.setFrameDuration` dispatches the intent; real-WASM TabState tests cover
  set + undo/redo **in memory** (snapshot round-trip is 197's concern).
- The facade↔binding structural-compatibility check stays green.

## Blocked by

- [195 — Per-frame duration (Rust core)](195-frame-duration-core.md)

Unblocks 197 and 198.
