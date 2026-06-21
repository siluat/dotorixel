---
title: "Per-frame duration — WASM binding + journal intent + TabState"
status: done
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

## Results

| File | Description |
|------|-------------|
| `wasm/src/lib.rs` | `WasmFrameMetadata.duration_ms` getter; `frames_metadata()` carries `{ id, duration_ms }`; `set_frame_duration` parses the UUID, clamps to `[1, 60_000]` via `MIN/MAX_FRAME_DURATION_MS` associated constants, delegates to the core |
| `src/lib/canvas/canvas-model.ts` | `FrameMetadata.duration_ms` field + `Document.set_frame_duration` on the facade |
| `src/lib/canvas/fake-drawing-ops.ts` | Fake gains the field + method |
| `…/document-change-journal.svelte.ts` | Undoable `set-frame-duration` intent: snapshot → apply → render + dirty (no viewport reclamp); `set-layer-visibility`-style no-op guard (throws on unknown frame) |
| `…/tab-state.svelte.ts` | `setFrameDuration(id, durationMs)` dispatch through `#mutate` (one commit = one undo step) |
| `wasm/src/lib.rs` (tests) | Native round-trip + clamp + default-duration coverage |
| `src/lib/wasm/wasm-document.test.ts` | Error contract: invalid UUID / unknown frame throws at the real boundary |
| `…/document-change-journal.test.ts` | Apply (snapshot+render+dirty, no reclamp), no-op guard, unknown-frame throw |
| `…/tab-state.svelte.test.ts` | Real-WASM set + undo/redo + no-op (in memory) |

### Key Decisions
- The `[1, 60_000]` clamp lives only at the WASM boundary (single source). The
  journal no-op guard compares the requested value as-is — mirroring
  `set-layer-visibility` — rather than re-deriving the clamp in TS.
- An unknown frame id **throws** in the journal guard (mirrors `reorder-frame`),
  not a silent no-op.
- The invalid-UUID / unknown-frame error test lives at the JS WASM boundary, not
  native `cargo test`: constructing the `JsError` those paths return panics on a
  non-wasm target.

### Notes
- **Handoff to 198**: the facade `set_frame_duration(durationMs: number)` does not
  reject negative/NaN at the type level. Measured boundary coercion: `NaN → 1`,
  `250.7 → 250`, but `-5 → 60000` (a negative wraps high through `u32`, then clamps
  to the **max**, not the min). A bounded numeric input (`min=1 max=60000`) in 198
  avoids this; 196 deliberately keeps the clamp single-sourced over a duplicate
  TS-side guard.
- Duration in the snapshot/persistence is 197's concern; the timeline control is
  198's. Both remain open under parent 193 (3 / 5 sub-issues done).
