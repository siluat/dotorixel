---
title: Rename single-canvas history to PixelCanvasHistory and delete the fused machinery
status: ready-for-agent
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
