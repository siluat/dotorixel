# 002 — Tools — pencil, eraser (Rust core migration)

## Results

| File | Description |
|------|-------------|
| `crates/core/src/tool.rs` | `ToolType` enum (Pencil, Eraser), `apply()` method, `interpolate_pixels()` free function, 16 tests |
| `crates/core/src/lib.rs` | Added `pub mod tool;` and `pub use tool::ToolType;` re-export |

### Key Decisions

- `apply()` is a method on `ToolType` — natural receiver ("pencil applies to canvas"), follows CLAUDE.md "`impl` blocks for behavior" principle
- `interpolate_pixels()` is a free function — pure coordinate math with no natural type owner
- Coordinates accepted as `i32` — matches `screen_to_canvas()` output which can be negative; bounds checking handled internally
- Returns `bool` instead of `Result` — single failure mode (out-of-bounds) doesn't warrant a dedicated error type
- `Vec::with_capacity(max(|dx|, |dy|) + 1)` — Bresenham output size is predictable, avoids heap reallocation
