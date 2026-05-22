---
title: "Reference Layer: Rust core — `set_reference_placement` + `resize` 9-anchor placement transform"
status: done
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Two `Document` extensions that together let placements move and follow canvas resizes:

- `set_reference_placement(id, placement)` — atomic placement update used by drag-release commits, keyboard nudges, and "Restore original size".
- `Document::resize(width, height, anchor)` extended (or paired with a new `resize_with_placement`) so that every Reference Layer's placement transforms by the same 9-anchor factor used for Pixel Layers' crop/extend.

The transform on each Reference placement:

```text
anchor_x_factor ∈ {0, 0.5, 1.0}  // left, center, right
anchor_y_factor ∈ {0, 0.5, 1.0}  // top, center, bottom

placement.x += (new_width  − old_width)  × anchor_x_factor
placement.y += (new_height − old_height) × anchor_y_factor
placement.scale  // unchanged
```

The source RGBA buffer is never modified — when the new canvas is smaller and the reference's projected footprint extends past the new bounds, the composite naturally clips.

## Acceptance criteria

- `Document::set_reference_placement(id, placement)` updates the placement on the named Reference Layer; returns an appropriate error (or `None`) when the id is wrong-variant or absent.
- `Document::resize(...)` translates every Reference Layer's placement by the chosen 9-anchor factor. Scale is unchanged.
- Top-left anchor (factor=0,0): placements unchanged.
- Center anchor (factor=0.5,0.5): reference's center remains at the new canvas center.
- Bottom-right anchor (factor=1,1): placement shifts by the full delta — bottom-right corner stays anchored.
- Canvas shrink: placement transforms identically (composite clips naturally; source buffer untouched).
- Pixel Layer crop/extend behavior is unchanged.
- Inline unit tests cover all 9 anchors × grow and shrink for placement transform, and verify the source RGBA is bit-identical before/after.

## Blocked by

- [110 — Rust core: `add_reference_layer` + composite paths](110-reference-layer-document-add-and-composite-paths.md)

## User stories addressed

- #7, #8, #9, #24, #25, #26.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/canvas.rs` | Adds `ResizeAnchor::placement_factor() -> (f32, f32)` returning `{0.0, 0.5, 1.0}` axis factors for placement translation under document resize. |
| `crates/core/src/document.rs` | Adds `LayerError::LayerKindMismatch { id, expected, actual: LayerKindTag }` variant + `Display`. Adds `Document::set_reference_placement(id, placement) -> Result<(), LayerError>`. Extends `Document::resize` so each Reference Layer's placement is translated by `(new_size − old_size) × placement_factor`; scale, source RGBA, and natural dimensions are unchanged. |
| `crates/core/src/document.rs` (tests) | 5 new inline tests: `set_reference_placement` happy path / unknown id / Pixel target; table-driven `resize` placement transform (9 anchors × grow & shrink); resize source-RGBA + natural-dims preservation. Removed obsolete `resize_carries_reference_layers_through_unchanged` (its surviving assertions are absorbed by the new tests). |

### Key Decisions

- **Wrong-kind error placement**: chose to extend `LayerError` with `LayerKindMismatch { id, expected, actual }` rather than introduce a dedicated `PlacementError`. Rationale: `LayerError` is the canonical "operation-on-layer-by-id" error type; the new variant is reusable by any future kind-specific layer mutator. Uses typed `LayerKindTag`, not strings.
- **`placement_factor` on `ResizeAnchor`**: anchor-derived value lives on the anchor type, parallel to the existing private `content_offset`. Returns `(f32, f32)` directly (`0.0` / `0.5` / `1.0`) rather than reusing the integer-divide-by-2 trick from `content_offset` — placement is `f32` natively, so the float values are direct and self-documenting.
- **`resize` extension, not new `resize_with_placement`**: extended the existing `Document::resize` rather than introduce a paired method. The Pixel Layer crop/extend behavior is unchanged; Reference Layers gain an inert (top-left-anchor) or non-trivial (other anchors) placement translation. Single API, one call site for shells.
- **Declarative builder in resize**: uses `ReferencePlacement::with_position(...)` (introduced in sub-issue 107) to produce the translated placement, rather than reconstructing the `ReferencePlacement` struct literal. Keeps "scale unchanged" as a property of the builder, not as a manual field copy.

### Notes

- Binding crates (`wasm`, `apple`) do not pattern-match on `LayerError`, so adding `LayerKindMismatch` does not affect them. Exposing `set_reference_placement` through the binding layer is sub-issue 113's responsibility.
- The `placement_factor` axis values match the user-facing PRD spec exactly (`0`, `0.5`, `1.0`) — center anchor keeps the reference center stationary, bottom-right shifts by the full delta, top-left leaves placement untouched.
- `cargo test -p dotorixel-core` → 324 passed / 0 failed. `cargo check --workspace --all-targets` clean. `cargo clippy -p dotorixel-core --all-targets` introduces no new warnings (the 3 pre-existing warnings in `pixel_perfect.rs` and `tool.rs` are unrelated).
- Pre-existing `cargo fmt --check` debt in `wasm/src/lib.rs` (tracked in todo.md "Review backlog") was not addressed here.

### Amendment (2026-05-22)

PRD-105 was corrected: Document now has at most one Reference Layer. The placement and resize-anchor transform behavior remains valid, but future code should express it against the singleton Reference underlay rather than "every Reference Layer."
