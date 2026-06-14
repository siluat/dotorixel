---
title: Carve out Document History over a shared generic history ring
status: done
created: 2026-06-14
---

## Context

From an architecture-depth review of the undo/redo **History**. Today one core `HistoryManager` fuses two unrelated value types — single-canvas `Snapshot`s and whole-`Document` snapshots — behind a `HistoryEntry` enum, and suppresses the type system with `expect_canvas`/`expect_document` runtime panics to forbid mixing. The web shell only ever drives the document path; the Apple shell only ever drives the single-canvas path. They never share a manager, so the panic is a purely latent tripwire.

The agreed deepening is two never-mixed **History** species over one shared generic ring that owns the undo/redo invariant. Canonical vocabulary is recorded in `CONTEXT.md` (History / PixelCanvas History / Document History). Type shape decided during the review:

```rust
// private — owns the undo/redo invariant in one place
struct History<T> { undo: VecDeque<T>, redo: VecDeque<T>, max: usize }
// push: clear the redo future + evict oldest past `max`; undo/redo: swap across stacks

pub struct DocumentHistory   { inner: History<Document> }   // web species (this slice)
pub struct PixelCanvasHistory { inner: History<Snapshot> }  // Apple species (follow-up slice)
```

This slice delivers the **Document History** species end-to-end (core → WASM binding → web), leaving the pre-split `HistoryManager` in place for the Apple binding until the follow-up.

## What to build

A web-facing undo/redo path that runs on a dedicated `DocumentHistory` type built over a private generic `History<T>` ring, with the WASM binding and the web history port narrowed to the document path only.

- Introduce the private generic ring `History<T>` holding the LIFO undo/redo invariant: branch-discard on push, eviction once `max_snapshots` is exceeded, `clear`, `can_undo`/`can_redo`.
- Add public `DocumentHistory` (wraps `History<Document>`) exposing `push_document` / `undo_document` / `redo_document` (+ `can_undo` / `can_redo` / `clear`).
- Point the WASM history wrapper at `DocumentHistory` and remove its single-canvas surface (`push_snapshot` / `undo` / `redo` and `WasmSnapshot`) after confirming no web consumer relies on it — check the web-side WASM history test and the `bench` route. Remove the now-dead web single-canvas test.
- Narrow the web history port (the `HistoryManager` interface in the web shell) to the document path, renaming it to `DocumentHistory`, and update the structural type-sync check accordingly.
- Leave the pre-split core `HistoryManager` untouched and compiling for the Apple binding; its now-duplicated document path is deleted in the follow-up slice.

## Acceptance criteria

- A private generic ring owns the undo/redo invariant (branch-discard on push, eviction past the cap); the document species reuses it rather than re-implementing it.
- `DocumentHistory` round-trips every existing document-path behavior unchanged: active-layer pixel change, add/remove/reorder layer, set visibility, set reference placement, resize, marquee, floating-selection commit, and `next_layer_number` restoration.
- The WASM history binding exposes only the document path; the single-canvas WASM surface and `WasmSnapshot` are gone, with no remaining web or bench consumer.
- The web history port exposes only `push_document` / `undo_document` / `redo_document` (+ `can_undo` / `can_redo` / `clear`); the WASM↔TS structural type-sync check narrows to match.
- Web undo/redo works end-to-end in the editor (pixels, layers, resize, marquee, floating selection); the web and core document-path test suites pass.
- `cargo test`, `cargo build` (wasm + apple targets), and the web test suite are green; the Apple binding still compiles against the pre-split `HistoryManager`.

## Blocked by

None - can start immediately.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/history.rs` | Added private generic ring `History<T>` (owns the branch-discard/evict/swap invariant) and public `DocumentHistory` over `History<Document>`; 20 document-path tests (round-trips, LIFO order, content-verified oldest-eviction) |
| `crates/core/src/lib.rs` | Export `DocumentHistory` |
| `wasm/src/lib.rs` | `WasmHistoryManager` now wraps `DocumentHistory`; removed the single-canvas surface (`push_snapshot`/`undo`/`redo`) and `WasmSnapshot` |
| `src/lib/canvas/adapter-types.ts` | Narrowed + renamed the web port `HistoryManager` → `DocumentHistory` (document path only); deleted the `Snapshot` interface |
| `src/lib/canvas/wasm-backend.ts`, `editor-session/canvas-backend.ts`, `editor-session/tab-state.svelte.ts`, `editor-session/document-change-journal.svelte.ts` | Renamed factory/port `createHistoryManager` → `createDocumentHistory` and the journal's history type/field |
| `src/lib/canvas/wasm-sync.test.ts`, `document-hydration.test.ts`, `editor-session/document-change-journal.test.ts` | Narrowed the structural type-sync check; renamed; dropped the canvas-path mock methods |
| `src/lib/wasm/wasm-history.test.ts` | Deleted — entirely single-canvas; the document-path WASM round-trip is covered by `document-hydration.test.ts` |

### Key Decisions

- **Generic ring is private, tested through `DocumentHistory`.** `History<T>` carries the undo/redo invariant in one place; tests exercise it via the public species so they survive internal refactors.
- **Rename extended past the interface to the factory + deps field.** The issue named only the interface, but `CONTEXT.md` lists "history manager" as an avoided term, so `createDocumentHistory` and the journal field were renamed too for vocabulary consistency.
- **Added `# Panics` to public `DocumentHistory::new`** per the Rust doc-comment convention (the pre-split `HistoryManager::new` had omitted it).

### Notes

- **`HistoryManager` left intact** for the Apple binding (single-canvas path); its now-duplicated document path is deleted in the follow-up slice [181](181-pixelcanvas-history-rename.md), which this unblocks. The shared generic ring therefore underlies only Document History today — the PixelCanvas species migrates onto it in 181.
- **`default_max_snapshots()` on the WASM binding now has no consumer or test** (its only test lived in the deleted file). Left as exposed-but-unused surface; cleanup is out of scope.
- **Verified across five layers**: `cargo test` (core 426 / wasm 18, Apple compiles), web vitest 1446, `svelte-check` 0 errors, production `bun run build`, and Playwright E2E 98 (incl. `e2e/editor/history.test.ts`).
