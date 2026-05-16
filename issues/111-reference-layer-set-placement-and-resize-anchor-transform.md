---
title: "Reference Layer: Rust core — `set_reference_placement` + `resize` 9-anchor placement transform"
status: needs-triage
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
