---
title: "Reference Layer: WASM facade + TS `canvas-model.ts` interface"
status: done
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Expose every new `Document` method introduced in 110, 111, and 112 through the WASM facade, and extend the TS `Document` structural interface so the compile-time `wasm-sync.test.ts` check stays honest. No business logic in this layer.

Scope:

- In `wasm/`:
  - 1:1 bindings for `add_reference_layer`, `set_reference_placement`, `composite_for_export`, `try_get_pixel`, `layer_kind_at`, `layer_source_pixels_at`, `layer_source_dimensions_at`, `layer_placement_at`. Source RGBA accepted as `&[u8]` (or `Vec<u8>`) — pick the shape that matches existing PixelCanvas binding precedent during implementation.
  - The existing `resize` binding picks up the new placement-transform behavior automatically through the core (no signature change needed unless an explicit `resize_with_placement` is preferred — choose during implementation).
- In `src/lib/canvas/canvas-model.ts`:
  - Extend the read-only `Document` structural interface with the new method signatures.
- Smoke tests in `wasm/`: each new bound method called against a constructed Document, asserting no panic and the expected return shape.

## Acceptance criteria

- All new Document methods are reachable from TS through the WASM facade.
- `expectTypeOf<WasmDocument>().toMatchTypeOf<Document>()` (or equivalent in `wasm-sync.test.ts`) passes.
- Existing `wasm-pack` build succeeds; existing PixelCanvas/Document tests keep building.
- Smoke tests cover each new bound method (Reference-layer add, placement update, both composites, try_get_pixel, accessors).

## Blocked by

- [111 — Rust core: `set_reference_placement` + resize](111-reference-layer-set-placement-and-resize-anchor-transform.md)
- [112 — Rust core: `Document.try_get_pixel`](112-reference-layer-document-try-get-pixel.md)

## User stories addressed

- Bridge layer; no user-observable change yet.

## Results

| File | Description |
|------|-------------|
| `wasm/src/lib.rs` | Added the Reference Layer WASM facade surface, placement wrapper, and smoke tests for add/accessor/sampling/composite behavior. |
| `src/lib/canvas/canvas-model.ts` | Extended the structural `Document` contract with Reference Layer bridge methods and placement shape. |
| `src/lib/canvas/fake-drawing-ops.ts` | Updated the fake document test double to satisfy the expanded `Document` contract. |

### Key Decisions

- Accepted source RGBA as a borrowed byte slice in the WASM method, matching the existing pixel-buffer binding precedent while keeping ownership conversion inside the facade.
- Returned placement as a small WASM wrapper object instead of a loose numeric tuple so TS callers get named fields.

### Notes

- This remains bridge-only work; there is still no user-visible Reference Layer creation or manipulation flow.
- Workspace-level Rust formatting remains blocked by the pre-existing `wasm/src/lib.rs` formatting debt already tracked in `tasks/todo.md`.

### Amendment (2026-05-22)

PRD-105 was corrected: Reference Layer is a singleton fixed-bottom viewport underlay, and `Document.composite()` must be Pixel-only. The facade surface should be reviewed before 118 proceeds:

- expose set/replace singleton semantics rather than append-only Reference creation;
- avoid requiring Reference-source `try_get_pixel` for v1;
- keep placement/source accessors needed by the shell underlay renderer;
- treat `composite_for_export()` as Pixel-only and do not depend on `composite()` containing Reference pixels.
