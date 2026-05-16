---
title: "Reference Layer: Rust core — `add_reference_layer` + composite paths + kind-aware accessors"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Wire the Reference Layer into `Document`: a constructor for Reference Layers with auto-fit initial placement, an extended on-screen composite that includes Reference Layers via the nearest-neighbor sampler, a new export-only composite that excludes them, kind-aware accessors that return `Option` for the wrong variant, and a documented response from drawing methods when the active layer is a Reference. This slice contains the **integration-level deep-module test for `LayerKind` enum branching** (testing decisions §1, #3).

Scope:

- In `crates/core/src/document.rs`:
  - `add_reference_layer(id, name, source_rgba, source_width, source_height) -> Result<...>` — computes the auto-fit aspect-preserving initial `ReferencePlacement` on the Rust side (`scale = min(canvas_w/source_w, canvas_h/source_h, 1.0)`, center at canvas center), appends the layer, sets it active. TS supplies source RGBA + dimensions + name; Rust owns the placement.
  - `composite()` — extended to include visible Reference Layers via the nearest-neighbor sampler at each output pixel. Pixel Layers continue to use direct RGBA copy. Hidden Reference Layers don't contribute.
  - `composite_for_export()` — new method that blends Pixel Layers only.
  - Kind-aware accessors that return `Option<...>` when called against the wrong variant: `layer_kind_at`, `layer_source_pixels_at`, `layer_source_dimensions_at`, `layer_placement_at`.
  - Drawing methods that mutate the active layer (`set_pixel`, `flood_fill`, `apply_tool`) check `LayerKind` of the active layer; if Reference, return a `LayerKindMismatch` error (or a clear "no pixels mutated" result, depending on the call). Signature shape stays compatible with existing callers — the TS tool runner translates the response into a silent no-op in 124.

## Acceptance criteria

- `Document::add_reference_layer` appends a Reference Layer and sets it active, computing auto-fit placement on the Rust side.
- Initial placement for source ≤ canvas: `scale = 1.0`, centered.
- Initial placement for source > canvas in one or both axes: scaled-down so the longest axis fits, centered, aspect preserved.
- `Document::composite()` blends every visible layer source-over from bottom up; Reference Layers contribute via the sampler; hidden Reference Layers don't contribute.
- `Document::composite_for_export()` blends Pixel Layers only; Reference Layers are absent even if visible.
- Kind-aware accessors return `Some(...)` for the matching variant and `None` for the other.
- Drawing methods against a Reference-active document return `LayerKindMismatch` (or the documented no-op response). Pixel-active behavior is unchanged.
- Mixed-kind Document preserves every layer's kind across the snapshot round-trip (asserted at the Rust level; relies on the umbrella from 107).
- Inline unit tests cover: auto-fit cases (source≤canvas, source>canvas one axis, source>canvas both axes with different aspect ratios), composite vs composite_for_export equality on mixed-kind, kind-aware accessors, drawing method response on Reference-active.

## Blocked by

- [107 — Rust core: `Layer` umbrella refactor](107-reference-layer-kind-umbrella-refactor.md)
- [108 — Rust core: `ReferencePlacement` value type](108-reference-placement-value-type.md)
- [109 — Rust core: nearest-neighbor sampler](109-reference-layer-nearest-neighbor-sampler.md)

## User stories addressed

- #2, #10, #15, #16, #23.
