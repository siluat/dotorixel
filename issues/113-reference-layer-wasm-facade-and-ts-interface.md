---
title: "Reference Layer: WASM facade + TS `canvas-model.ts` interface"
status: needs-triage
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
