---
title: Encapsulate flood_fill as a PixelCanvas method
status: done
created: 2026-04-13
---

## Problem

`flood_fill` in `tool.rs` maintains a `visited` bitmap using row-major indexing (`y * width + x`) that mirrors `PixelCanvas::pixel_index` — a private method in `canvas.rs`. This is a hidden contract: the compiler cannot enforce it, and a future change to the canvas buffer layout would silently break flood fill.

Every other function in `tool.rs` (`interpolate_pixels`, `rectangle_outline`, `ellipse_outline`) is a pure geometry computation that takes coordinates in and returns coordinates out, with zero canvas dependency. `flood_fill` is fundamentally different — it reads the current canvas state, traverses the pixel data structure via BFS, and mutates pixels in place. It belongs with the data it operates on.

## Proposed Interface

Move `flood_fill` into `PixelCanvas` as a public method:

```rust
impl PixelCanvas {
    /// Flood-fills a contiguous region starting at (start_x, start_y) with fill_color.
    /// Returns true if any pixels were changed, false if the start pixel is out of
    /// bounds or already matches fill_color.
    pub fn flood_fill(&mut self, start_x: u32, start_y: u32, fill_color: Color) -> bool {
        // BFS using self.width, self.get_pixel(), self.set_pixel()
        // visited array indexed via the same layout as pixel_index
    }
}
```

Callers change from:

```rust
flood_fill(&mut canvas, x, y, color)
```

to:

```rust
canvas.flood_fill(x, y, color)
```

The WASM binding (`wasm_flood_fill`) updates its body to call `canvas.flood_fill(x, y, color)` — the JS-facing signature stays the same.

## Commits

### Commit 1: Add `PixelCanvas::flood_fill` method with tests

Additive only — no existing code is modified or removed.

1. Add `pub fn flood_fill(&mut self, start_x: u32, start_y: u32, fill_color: Color) -> bool` to the `PixelCanvas` impl block. The BFS logic is the same as the current free function, but uses `self.width()`, `self.get_pixel()`, `self.set_pixel()`, and `self.is_inside_bounds()` directly. The visited array indexing (`y * width + x`) is now co-located with `pixel_index`.
2. The signature takes `u32` coordinates (consistent with all other `PixelCanvas` methods). The i32 negative-coordinate guard is not needed here — that responsibility belongs to the WASM binding layer.
3. Add flood fill tests to `canvas.rs`'s `mod tests`. Adapt the 6 non-negative-coordinate tests from `tool.rs` to use method syntax (`canvas.flood_fill(x, y, color)`) and `u32` coordinates. The 2 negative-coordinate tests (`flood_fill_negative_x_returns_false`, `flood_fill_negative_y_returns_false`) do not transfer — they tested i32 behavior that the u32 signature makes impossible.
4. Run `cargo test` — all existing tests plus the new canvas tests pass. The old `tool.rs` tests still pass because the old free function is untouched.

### Commit 2: Migrate WASM binding to `PixelCanvas::flood_fill`

1. Update `wasm_flood_fill` in `wasm/src/lib.rs` to perform the i32-to-u32 conversion and call `canvas.inner.flood_fill(ux, uy, color.inner)`. Add the negative-coordinate guard (`if x < 0 || y < 0 { return false; }`) in the WASM binding — this is the same pattern used by `ToolType::apply` for its i32 coordinates.
2. Remove `flood_fill` from the import list: `use dotorixel_core::tool::{...}`.
3. Run `cargo test` and `bun run test` — all tests pass. The JS-facing signature is unchanged, so no TypeScript modifications are needed.

### Commit 3: Remove old `flood_fill` from `tool.rs`

1. Delete the `flood_fill` free function from `tool.rs`.
2. Delete the 8 flood fill tests from `tool.rs`'s `mod tests` (their coverage is now in `canvas.rs`, minus the 2 negative-coordinate tests which are now handled at the WASM boundary).
3. Remove the `VecDeque` import from `tool.rs` if no other code uses it.
4. Run `cargo test` — all tests pass. `tool.rs` now contains only `ToolType` (enum + `apply` method) and the pure geometry functions.

## Decision Document

- **Signature change: i32 → u32.** `PixelCanvas` methods consistently use `u32` for pixel coordinates. The new `flood_fill` method follows this convention. The i32 negative-coordinate check moves to the WASM binding layer, matching how `ToolType::apply` already handles i32 input.
- **No lib.rs re-export needed.** The current `lib.rs` does not re-export `flood_fill` — the WASM crate imports it via `dotorixel_core::tool::flood_fill`. After the move, the WASM crate imports it via `PixelCanvas` (already re-exported via `dotorixel_core::canvas::PixelCanvas`), so no new re-export is required.
- **No TypeScript changes.** The WASM binding's JS-facing signature (`wasm_flood_fill(canvas, x, y, color) → bool`) is unchanged. The TypeScript `DrawingOps` interface and `wasm-backend.ts` remain untouched.
- **In-process dependency.** Pure computation over an in-memory pixel buffer. No I/O, no external dependencies. Merged directly into the existing `canvas` module.

## Testing Decisions

- **Good tests verify behavior through the public interface.** Flood fill tests should assert on observable pixel state (which pixels changed, which didn't) after calling `canvas.flood_fill()`. They should not depend on internal details like the visited array or BFS traversal order.
- **Tests that move:** The 6 behavioral tests (single pixel fill, entire canvas fill, 4-connectivity, boundary stop, same-color noop, out-of-bounds) transfer directly to `canvas.rs` with u32 coordinates and method syntax.
- **Tests that don't move:** The 2 negative-coordinate tests tested the i32 → early-return path. With the u32 signature, this path is structurally impossible. The WASM binding's negative-coordinate guard is not unit-tested in Rust (it's covered by existing TypeScript WASM tests).
- **Prior art:** `canvas.rs` already has 53 inline unit tests following the same pattern (create canvas, perform operation, assert pixel state). The new tests follow this established style.

## Out of Scope

- **`ToolType::apply` placement.** `apply` also takes `&mut PixelCanvas`, but unlike `flood_fill` it only uses public API methods (`set_pixel`, `is_inside_bounds`). It does not assume internal buffer layout. Moving it is a separate decision.
- **Performance optimization of flood_fill.** The current BFS with a `Vec<bool>` visited array works correctly within the 256×256 MAX_DIMENSION. Optimizations (scanline fill, bitset visited) are out of scope.
- **Additional canvas mutation methods.** This refactor moves one function. Adding other canvas-mutating operations (e.g., line drawing, shape filling) is a separate concern.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/canvas.rs` | Added `PixelCanvas::flood_fill` method + 6 boundary tests |
| `crates/core/src/tool.rs` | Removed `flood_fill` free function, 8 tests, and `VecDeque` import |
| `wasm/src/lib.rs` | Updated `wasm_flood_fill` to call `canvas.inner.flood_fill()` with i32→u32 conversion |

### Key Decisions
- `flood_fill` takes `u32` coordinates (consistent with all other `PixelCanvas` methods). The i32 negative-coordinate guard moved to the WASM binding layer.
- 2 negative-coordinate tests dropped (u32 makes them structurally impossible). 6 behavioral tests migrated to canvas.rs.
