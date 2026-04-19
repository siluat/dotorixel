---
title: Pixel Perfect filter — Rust core function
status: done
created: 2026-04-18
parent: 069-pixel-perfect-drawing.md
---

## What to build

Implement the L-corner judgment algorithm as a pure function in the Rust core. Expose it automatically to both shells via WASM + UniFFI bindings. This slice fixes correctness independently through Rust tests; shell-side integration is not yet included (called from the next slice).

See the parent PRD's "Rust Core module" section and the L-corner judgment rule reference.

## Acceptance criteria

- `pixel_perfect_filter(points: &[(i32, i32)], prev_tail: Option<[(i32, i32); 2]>) -> FilterResult` pure function implemented
  - `FilterResult = { actions: Vec<Action>, new_tail: [(i32, i32); 2] }`
  - `Action::Paint(x, y)` / `Action::Revert(x, y)` variants
- `is_l_corner(prev, cur, next) -> bool` helper function (3-window rule)
- No dependencies, pure integer arithmetic
- Table-based unit tests (at least 10 cases):
  - Empty input / single point / two points
  - 3-point horizontal, vertical, diagonal lines (no filtering)
  - 3-point L-corners in 8 symmetric directions (middle reverted)
  - Consecutive staircase (multiple L-corners in a row) — each middle reverted in turn
  - Segment boundary — correct revert when an L-corner forms across `prev_tail`
  - Self-intersection revisit — same coordinate reappearing still obeys the rule
- WASM binding export (importable from TS; actual call is in the next slice)
- UniFFI binding auto-generated
- `cargo test` passes

## Blocked by

None — can start immediately (can run in parallel with 070)

## Scenarios addressed

Algorithmic foundation for:
- Scenario 1 (Pencil PP ON L-shape middle absent)
- Scenario 4 (horizontal/vertical line preservation)
- Scenario 5 (single tap)
- Scenario 10 (the algorithmic portion of self-intersection first-touch wins)
- Scenario 12 (input-device-agnostic — the filter only handles coordinates)

## Results

| File | Description |
|------|-------------|
| `crates/core/src/pixel_perfect.rs` | New module — `Action`/`TailState`/`FilterResult` types, `pixel_perfect_filter`, `is_l_corner`, 10 unit tests |
| `crates/core/src/lib.rs` | Register `pub mod pixel_perfect;` |
| `wasm/src/lib.rs` | `WasmActionKind` enum + `WasmFilterResult` wrapper + `wasm_pixel_perfect_filter` export |
| `apple/src/lib.rs` | `apple_pixel_perfect_filter` free function wrapping core call with `ScreenCanvasCoords` inputs |
| `src/lib/wasm/wasm-pixel-perfect.test.ts` | 5-case Vitest smoke test covering exports, collinear/L-corner behavior, input validation |

### Key Decisions

- **`TailState` enum over spec's `Option<[(i32, i32); 2]>`** — Option\<pair\> couldn't express the 0/1/2-point carry state needed for boundary-spanning L-corner detection. Enum variants use positional `i32` fields for UniFFI auto-enum compatibility (UniFFI does not support Rust tuples).
- **Action ordering = Batch (all Paints first, then Reverts)** — single-pass implementation; user-visible result is identical for live strokes because Revert is interpreted via a caller-side first-touch cache.
- **New `pixel_perfect.rs` module** rather than appending to the 697-line `tool.rs` — keeps the L-corner algorithm's contract self-contained and discoverable.
- **WASM action encoding** — `WasmActionKind { Paint = 0, Revert = 1 }` enum exposed alongside flat `Int32Array` serialization. Avoids wasm-bindgen's enum-with-data limitation while making the flat-triple protocol explicit on both sides.
- **No crate-root re-exports** — `dotorixel_core::pixel_perfect::TailState` over `dotorixel_core::TailState`. Follows the tool-module style (where `interpolate_pixels` etc. stay namespaced) rather than the canvas/viewport style.

### Notes

- Shell integration is deferred to issues 072 (Pencil) and 073 (Eraser). This slice only verifies the binding is importable on both shells.
- Tail update uses the combined-path last-2 rule, not just input-last-2 — required so boundary-spanning L-corners across batches remain detectable. Regression test: `prev_tail_enables_l_corner_detection_across_batches`.
- `apple/generated/` is gitignored; Swift bindings are regenerated on demand by `scripts/build-rust.sh`.
