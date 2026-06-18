---
title: "Frame WASM binding + Change Journal intents"
status: ready-for-agent
created: 2026-06-18
parent: 186-frame-management.md
---

# Frame WASM binding + Change Journal intents

## Parent

[186 — Frame management (add/delete/duplicate/reorder) — M4 entry](186-frame-management.md)

## What to build

Expose the core frame model (188) to the web shell through the WASM `Document`
binding and route frame mutations through the existing `DocumentChangeJournal`
seam, exactly as layer operations do. No persistence (190) and no UI (191) yet —
verifiable through journal/WASM unit tests.

- The WASM `Document` binding gains the matching methods: `add_frame`,
  `duplicate_frame`, `remove_frame`, `reorder_frame`, `set_active_frame`, plus
  reads for the panel — `frames_metadata()` / `active_frame_id()` /
  `frame_count()` and a cel read (e.g. `cel_pixels_at(layerIndex, frameId)`) for
  occupancy/content. The cached layer projection invalidates on `renderVersion`
  as today; frame mutations bump it the same way.
- New **undoable** document intents — `add-frame`, `duplicate-frame`,
  `remove-frame`, `reorder-frame` — each flowing through the established
  snapshot → apply → after-mutation pipeline (push history, mutate WASM document,
  reclamp / invalidate render / mark dirty).
- New **persisted, non-undoable** UI intent — `set-active-frame` — mirroring
  `set-active-layer`: marks dirty, bypasses history.
- Switching the active frame first restores/commits any in-flight Floating
  Selection (the journal already restores the floating baseline before document
  intents) so lifted pixels land on their origin cel.

## Acceptance criteria

- Each of the four frame document intents produces the expected document state
  (verified via composite / frame-metadata reads).
- The four document intents push a history entry and mark the document dirty;
  undo restores both frame structure and per-cel pixels, and redo re-applies.
- `set-active-frame` marks the document dirty but does **not** push a history
  entry (timeline navigation doesn't pollute undo history).
- Switching frames with an in-flight Floating Selection commits it first, onto the
  cel it was lifted from.
- WASM read methods (`frames_metadata`, `active_frame_id`, `frame_count`, cel
  read) return values consistent with the underlying core document and reflect
  mutations.
- Unit tests cover each intent's document effect, the history push / no-push
  split, and the floating-selection commit-on-switch.

## Blocked by

- [188 — Frame cel-grid + frame operations (Rust core)](188-frame-cel-grid-core.md)
