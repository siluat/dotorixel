---
title: "Layer system: Rust HistoryManager — Document snapshot support"
status: ready-for-agent
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
