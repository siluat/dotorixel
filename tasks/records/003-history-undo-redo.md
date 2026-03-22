# 003 — History — undo/redo snapshot logic (Rust core migration)

## Results

| File | Description |
|------|-------------|
| `crates/core/src/history.rs` | `HistoryManager` struct with `VecDeque`-based undo/redo stacks, `Default` trait impl, 20 tests |
| `crates/core/src/lib.rs` | Added `pub mod history;` and `pub use history::HistoryManager;` re-export |
| `CLAUDE.md` | Added doc comment guideline to Rust Migration section |

### Key Decisions

- `Vec<u8>` snapshots instead of `PixelCanvas` — keeps history module decoupled from canvas module, matches TS approach
- `VecDeque<Vec<u8>>` for undo stack — O(1) eviction via `pop_front()` vs `Vec::remove(0)` O(n)
- `&[u8]` input with `.to_vec()` copy — ownership-based mutation safety, equivalent to TS `.slice()`
- No error type — all operations are infallible, `undo`/`redo` return `Option<Vec<u8>>`
- Doc comment guideline added — write when it adds signal (non-obvious side effects), skip when the signature speaks (trivial getters, `Option`/`Result` return semantics)
