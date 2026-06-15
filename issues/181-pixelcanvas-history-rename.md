---
title: Rename single-canvas history to PixelCanvasHistory and delete the fused machinery
status: done
created: 2026-06-14
---

## Context

Follow-up to the **History** split (see issue 180). After the **Document History** species is carved out and the WASM binding moved onto it, the pre-split core `HistoryManager` is left holding the single-canvas path for the Apple binding plus a now-dead document path, the `HistoryEntry` enum, and the `expect_canvas` / `expect_document` panics. This slice finishes the split: the single-canvas history becomes its own named species over the shared ring, and the fused machinery is deleted so that mixing species is unrepresentable rather than guarded at runtime.

```rust
pub struct PixelCanvasHistory { inner: History<Snapshot> }  // Apple species, was HistoryManager
// HistoryEntry enum + expect_canvas/expect_document panics + dead document-path methods → deleted
```

Canonical vocabulary (PixelCanvas History) is already recorded in `CONTEXT.md`. The Apple shell stays on the single-canvas model — this is a rename, not a data-model migration.

## What to build

The **PixelCanvas History** species and the removal of every trace of the fused single-type history, wired through the Apple binding.

- Rename the pre-split `HistoryManager` to `PixelCanvasHistory`, backing it with `History<Snapshot>` and retaining the dimension assertions on snapshot push/undo/redo.
- Delete the `HistoryEntry` enum, `expect_canvas`, `expect_document`, and the document-path methods that previously lived on the fused type (they now belong only to `DocumentHistory`).
- Update the Apple binding to wrap `PixelCanvasHistory`, keeping the Swift-facing history API byte-for-byte unchanged.
- Split the core history tests by species so each exercises its own type.
- Amend ADR `web-document-layer-apple-preserved` to name `PixelCanvasHistory` as the preserved single-canvas history (recording that the split keeps Apple's single-canvas model intact and is not a data-model migration).

## Acceptance criteria

- The single-canvas history is `PixelCanvasHistory` over `History<Snapshot>`; single-canvas behavior — resize round-trip, LIFO order, eviction at the cap, `clear` — is unchanged.
- `HistoryEntry`, `expect_canvas`, and `expect_document` no longer exist; attempting to mix the two species is a compile error, with no remaining runtime mix-path panic.
- The Apple binding compiles against `PixelCanvasHistory`; the Swift-facing `AppleHistoryManager` surface is unchanged.
- Core history tests are organized by species (`PixelCanvasHistory` / `DocumentHistory`) and pass.
- ADR `web-document-layer-apple-preserved` is amended to reference `PixelCanvasHistory`.
- `cargo test` and `cargo build` for both the wasm and apple targets are green.

## Blocked by

- Issue 180 (Carve out Document History over a shared generic history ring) — the WASM binding must be moved onto `DocumentHistory` before the fused document path can be removed from the single-canvas type.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/history.rs` | Renamed `HistoryManager` → `PixelCanvasHistory` over `History<Snapshot>`; deleted the `HistoryEntry` enum, `expect_canvas`/`expect_document`, and the document-path methods. Added a private `debug_assert_rgba_len` helper shared by push/undo/redo. Split the tests into a `pixel_canvas_history_tests` species module (document-path tests already live in `document_history_tests`). |
| `crates/core/src/lib.rs` | Re-export `HistoryManager` → `PixelCanvasHistory`. |
| `apple/src/lib.rs` | `AppleHistoryManager` now wraps `Mutex<PixelCanvasHistory>`; the UniFFI-exported surface is byte-for-byte unchanged (verified against the checked-in `apple/generated/dotorixel_apple.swift`). |
| `docs/decisions/web-document-layer-apple-preserved.en.md` | Status-line amendment naming `PixelCanvasHistory` as the preserved single-canvas history — a rename, not a data-model migration. |

### Key Decisions

- **Species side by side over the shared ring.** `PixelCanvasHistory` and `DocumentHistory` now both wrap `History<T>`; mixing the two is a compile error, with the `HistoryEntry`/`expect_*` runtime mix-path panic removed entirely.
- **`new(0)` panic message unified.** The single-canvas constructor delegates to the shared ring, so the panic text is now `"History max must be > 0"` (was `"HistoryManager max_snapshots must be > 0"`). The message is not a public contract; the species test was updated to match.
- **ADR amendment follows the existing one-line convention** (Status-line `Amended (date): …`, as in `reference-layer-excluded-from-export`), not a new `## Amendments` heading.

### Notes

- **Apple `EditorState` undo/redo pixel-restore round-trip has no automated test** (Swift XCTest covers only `resizeClearsHistory` — the `canUndo`/`canRedo` flags + resize-clear). This refactor did **not** introduce that gap: the Swift surface is byte-for-byte unchanged, so the rename neither widens nor narrows it. The core `PixelCanvasHistory` behavior itself is fully covered by `cargo test`. Filling the gap (a Swift round-trip test) is a separate follow-up, out of scope for this rename.
- Historical `HistoryManager` mentions in past issue files, `tasks/records/`, `done.md`, and the `uniffi-mutex-interior-mutability` ADR are point-in-time records and were intentionally left unchanged. `CONTEXT.md` already records the canonical vocabulary.
