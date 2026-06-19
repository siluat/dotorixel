---
title: "Frame WASM binding + Change Journal intents"
status: done
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

## Results

| File | Description |
|------|-------------|
| `crates/core/src/document.rs` | `cel_pixels_at(layer_index, frame_id)` — frame-agnostic cel read (active pointer unmoved) + tests |
| `wasm/src/lib.rs` | `WasmFrameMetadata` + 9 `WasmDocument` frame methods (5 mutate / 4 read) + happy-path unit tests |
| `src/lib/canvas/canvas-model.ts` | `FrameMetadata` interface + the 9 frame methods on the `Document` facade |
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | 4 undoable + 1 persisted frame intents, `createFrameId` dep, `frameId` result, guards / apply / after-mutation |
| `src/lib/canvas/editor-session/document-change-journal.test.ts` | 8 journal tests (per-intent effect + history push/no-push split) |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `addFrame` / `duplicateFrame` / `removeFrame` / `reorderFrame` / `setActiveFrame` dispatch |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | 7 integration tests (real WASM): document state, undo/redo restores frame + per-cel pixels, non-undoable set-active, floating commit-on-switch |
| `src/lib/canvas/fake-drawing-ops.ts` | Frame methods on the `Document` fake (interface conformance) |

### Key Decisions

- **`frames_metadata()` returns `FrameMetadata { id }[]`** (not `string[]`) — mirrors `layers_metadata()` and leaves the seam the next M4 task (per-frame speed) extends with a duration. Only `id` for now.
- **`cel_pixels_at` lives in the core** — the `Cels` store is core-private, so a per-frame read must originate there; the core is its authoritative owner and the panel (191) needs per-frame occupancy/content.
- **Frame ops don't reclamp the viewport** (unlike layer ops / `set-active-layer`): frames change neither canvas dimensions nor the active layer, so Navigation Bounds are unaffected — all five intents run `invalidateRender + markDirty` only.
- **Undo/redo needed no history changes** — `DocumentHistory.push_document` clones the whole `Document`, so the frame axis and per-cel pixels round-trip automatically; the undoable intents just push the snapshot.
- **Fail at the boundary** — the WASM binding parses the UUID and rejects duplicate frame ids; the core trusts its inputs (`debug_assert`).

### Notes

- **No persistence yet** — frames do not survive a reload until 190 (Document schema V6). No user-facing impact: there is no UI to create multi-frame documents.
- **No UI yet** — the TabState frame dispatch methods exist but are not wired to any component until 191 (ruler shell) / 192 (operations UI).
- `createFrameId` is a test-only seam (defaults to `crypto.randomUUID()`; not wired in TabState, mirroring `createLayerId`).
- Verification: core 446 / wasm 25 / apple 25 cargo tests, svelte-check 0 errors, vitest 1474 — all green.
