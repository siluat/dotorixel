# 058 — Undo/Redo support for canvas resize

## Plan

### Context

The current history system stores snapshots as raw pixel byte buffers (`Vec<u8>`) only. When canvas dimensions change via resize, previous snapshots become invalid (buffer size mismatch), so the entire history is cleared. This task adds dimension metadata (width, height) to snapshots so resize operations become part of the undo/redo chain.

### Implementation

1. **Rust core — `Snapshot` struct + `HistoryManager` changes** (`crates/core/src/history.rs`, `crates/core/src/lib.rs`)
   - Add `Snapshot { width, height, pixels }` struct with `uniffi::Record` conditional derive
   - Change stacks from `VecDeque<Vec<u8>>` to `VecDeque<Snapshot>`
   - Update method signatures to include dimensions

2. **Rust core — `PixelCanvas::from_pixels` constructor** (`crates/core/src/canvas.rs`)
   - New constructor for dimension-changing undo/redo (avoids canvas↔history coupling)

3. **Rust tests** (`crates/core/src/history.rs`, `crates/core/src/canvas.rs`)
   - Update existing tests for new signatures
   - Add dimension-aware snapshot tests

4. **WASM bindings** (`wasm/src/lib.rs`)
   - `WasmSnapshot` struct, updated `WasmHistoryManager` signatures
   - `WasmPixelCanvas::from_pixels` static method

5. **Apple bindings — compile compatibility only** (`apple/src/lib.rs`, `apple/Dotorixel/State/EditorState.swift`)
   - Update API signatures for compilation; full resize undo UX deferred

6. **Editor state TypeScript** (`src/lib/canvas/editor-state.svelte.ts`)
   - Dimension-aware push/undo/redo, `handleResize` pushes snapshot instead of clearing
   - `#applySnapshot` helper for shared undo/redo logic

7. **TypeScript tests** (`src/lib/wasm/wasm-history.test.ts`, `src/lib/wasm/wasm-canvas.test.ts`, `src/lib/canvas/editor-state.svelte.test.ts`)
   - Resize undo/redo scenarios, `from_pixels` and `WasmSnapshot` tests

## Results

| File | Description |
|------|-------------|
| `crates/core/src/history.rs` | `Snapshot` struct (width, height, pixels) + `HistoryManager` dimension-aware API |
| `crates/core/src/canvas.rs` | `PixelCanvas::from_pixels` constructor for dimension-changing restore |
| `crates/core/src/lib.rs` | `Snapshot` re-export |
| `wasm/src/lib.rs` | `WasmSnapshot` struct + updated `WasmHistoryManager` + `WasmPixelCanvas::from_pixels` |
| `apple/src/lib.rs` | `AppleHistoryManager` API signature compatibility |
| `apple/Dotorixel/State/EditorState.swift` | Call site compatibility for new signatures |
| `src/lib/canvas/editor-state.svelte.ts` | Resize pushes snapshot instead of clearing history; `#applySnapshot` helper |
| `src/lib/wasm/wasm-history.test.ts` | Updated for new API + dimension-aware tests |
| `src/lib/wasm/wasm-canvas.test.ts` | `from_pixels` constructor tests |
| `src/lib/canvas/editor-state.svelte.test.ts` | 7 resize undo/redo integration tests |

### Key Decisions

- `Snapshot` uses public fields (no constructor) — field names visible at call site, `pixels.to_vec()` explicit in context
- `from_pixels` added to `PixelCanvas` instead of `restore_snapshot` — avoids canvas→history module coupling
- `#applySnapshot` uses structural type parameter — decoupled from concrete `WasmSnapshot`
- Apple: compile compatibility only — full resize undo UX deferred to separate task

### Notes

- Apple generated UniFFI bindings (`apple/generated/*.swift`) are gitignored and will regenerate on next Xcode build
- `WasmSnapshot.pixels()` clones the buffer — acceptable overhead for MVP canvas sizes (32×32 = 4KB)
