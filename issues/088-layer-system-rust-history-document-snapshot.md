---
title: "Layer system: Rust HistoryManager — Document snapshot support"
status: done
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Extend `crates/core/src/history.rs` so a snapshot captures the entire Document — the full layer stack and `nextLayerNumber` — and `undo`/`redo` restore the whole Document (both structural and pixel changes).

The existing single-canvas `Snapshot` interface is preserved on the public surface so callers that have not yet migrated keep working. This slice is still dead-code from the user's point of view — main is unaffected.

Scope:

- Extend `Snapshot` to carry a Document representation (or add a new variant if a discriminated form is preferred — implementation detail).
- `push_snapshot` accepts a Document and captures the full stack.
- `undo` / `redo` restore the whole Document, including the layer stack ordering, identifiers, visibility/opacity flags, and `nextLayerNumber`.
- Keep `DEFAULT_MAX_SNAPSHOTS=100`.
- Keep the existing `PixelCanvas` snapshot path callable for now (it will be retired by a later slice once nothing references it).

## Acceptance criteria

- `HistoryManager::push_snapshot` captures the full Document (layer stack + `nextLayerNumber`).
- `undo` after a draw restores the previous pixel state of the active layer.
- `undo` after `add_layer` / `remove_layer` / `reorder_layer` restores the full stack shape including identifiers.
- `redo` after `undo` re-applies the captured Document.
- `DEFAULT_MAX_SNAPSHOTS=100` retained; oldest snapshots are evicted as before.
- Existing `history.rs` tests still pass.

## Blocked by

- [087 — Rust core: Document/Layer + composite + add/delete/reorder](087-layer-system-rust-document-layer-core.md)

## Scenarios addressed

- Partial coverage of Scenario 6 (history groundwork, no UI yet).

## Results

| File | Description |
|------|-------------|
| `crates/core/src/history.rs` | Internal `HistoryEntry` enum (`Canvas(Snapshot)` / `Document(Document)`) added; stacks switched to `VecDeque<HistoryEntry>`. New public methods `push_document(&Document)`, `undo_document(&Document) -> Option<Document>`, `redo_document(&Document) -> Option<Document>`. Existing `push_snapshot` / `undo` / `redo` preserved unchanged on the public surface — they now wrap into `HistoryEntry::Canvas` internally. Variant guards `expect_canvas` / `expect_document` panic with actionable "do not mix paths" messages. `DEFAULT_MAX_SNAPSHOTS=100` retained via shared `push_entry` helper. 9 new inline tests (T1–T9) cover document round-trip across `set_pixel` / `add_layer` / `remove_layer` / `reorder_layer`, redo, push-clears-redo, `next_layer_number` preservation, and eviction. All 24 pre-existing canvas-path tests still pass; 33 history tests / 267 core tests total. `history.rs` is clippy-clean. Workspace builds clean — WASM/Apple bindings unaffected (still depend only on `Snapshot` struct + canvas-path methods). |

### Key Decisions

- **Discriminated internal enum, not enum-as-public-type.** Considered three approaches: (1) two parallel methods backed by an internal `HistoryEntry` enum, (2) shorter method names without "snapshot" suffix, (3) make the public `Snapshot` itself an enum. Chose option 2 (`push_document` / `undo_document` / `redo_document`) for internal symmetry across the three methods — opting into the shorter `_document` suffix everywhere instead of mirroring the existing `_snapshot` quirk on push only. Rejected option 3 because it would break the WASM `WasmSnapshot::pixels()` getter and the Apple uniffi `Snapshot { width, height, pixels }` Record exposure, which lies outside this dead-code slice's scope.
- **Variant mismatch panics rather than degrades.** `expect_canvas` / `expect_document` panic if a stack contains the wrong variant for the active path. A single `HistoryManager` is meant to be driven through one path at a time (canvas during transition, document afterward); silent fallthrough would mask programming errors. The panic message names what to do ("do not mix paths").
- **No visibility/opacity round-trip test.** Scope mentions these flags, but the AC list calls out only "structural and pixel changes." `Document` exposes no public mutator for `Layer.visible` / `Layer.opacity` yet — adding one solely for testing would be out of scope. `#[derive(Clone)]` on `Layer` and `Document` already guarantees the round-trip; a regression test belongs alongside the public mutator in 097 (visibility toggle).

### Notes

- Slice remains dead code from the user's perspective — neither the new methods nor the new internal enum are reachable from main. WASM facade (089) is the next slice that begins exposing the document path.
- Pre-existing clippy `-D warnings` errors in `pixel_perfect.rs` (`type_complexity` × 2) and `tool.rs` (`assertions_on_constants` × 1) are not introduced by this slice — confirmed by stashing the diff and re-running clippy on `main`. Captured for follow-up cleanup; out of scope here.
- Parent 086 frontmatter is already `status: done` (predates this slice's start) — left untouched per `/task-done` semantics, which only set parent to done, never reverse.
