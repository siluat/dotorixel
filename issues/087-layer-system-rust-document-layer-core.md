---
title: "Layer system: Rust core — Document/Layer + composite + add/delete/reorder"
status: ready-for-agent
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Add the Rust core's `Document` runtime model and `Layer` type. Implement source-over composite and the structural mutations (`add_layer`, `remove_layer`, `reorder_layer`, `set_active_layer`) on Document. The new modules are not yet wired through the WASM binding or the TS shell, so this slice is dead-code from the user's point of view — main is unaffected.

Scope:

- New module `crates/core/src/document.rs` with a `Document` type:
  - Fields: canvas dimensions, layer stack, active layer ID, `nextLayerNumber`, `timelinePanelCollapsed` flag.
  - `add_layer()` — insert directly above the active layer; the new layer becomes active.
  - `remove_layer(layer_id)` — UUID-keyed delete. Returns `LayerError::RemoveLastLayer` if the stack would become empty. On successful delete, an adjacent layer becomes active.
  - `reorder_layer(layer_id, new_index)` — move within the stack; clamp/validate the index.
  - `set_active_layer(layer_id)` — change the active pointer.
  - `composite() -> Vec<u8>` — RGBA row-major buffer, no caching. Source-over (Normal alpha-over). Skips `visible == false`. Multiplies `opacity` into the layer alpha.
  - `resize(width, height, anchor)` — apply the same anchor policy to every layer.
- New module `crates/core/src/layer.rs` with a `Layer` type:
  - Fields: `id: Uuid`, `name: String`, `pixels: PixelCanvas`, `visible: bool`, `opacity: f32`.
- Pixel-mutating delegations on Document (`set_pixel`, `flood_fill`, …) that route to the active layer. The single `PixelCanvas` public API is preserved unchanged.

## Acceptance criteria

- `Document::new(width, height)` creates a Document with one default layer and `nextLayerNumber=2`.
- `Document::add_layer` inserts directly above the active layer and sets the new one active.
- `Document::remove_layer` returns `LayerError::RemoveLastLayer` when the stack has only one layer.
- `Document::remove_layer` on a multi-layer stack relocates the active pointer to an adjacent layer.
- `Document::reorder_layer` rearranges the stack and the composite reflects the new depth order.
- `Document::composite` renders source-over for known input layers (transparent/opaque boundary, opacity, visibility off).
- `nextLayerNumber` is monotonic — never decreases on delete.
- No changes to `PixelCanvas` public API; existing tests keep passing.

## Blocked by

None — can start immediately.

## Scenarios addressed

- Partial coverage of Scenario 1, 2 (data-model groundwork, no UI yet).
