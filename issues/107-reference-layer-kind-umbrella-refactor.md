---
title: "Reference Layer: Rust core — `Layer` umbrella refactor (`LayerKind::Pixel | Reference`)"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Refactor `Layer` in `crates/core/src/layer.rs` to an umbrella over a `LayerKind` enum with `Pixel` and `Reference` variants. Existing layers all become `LayerKind::Pixel`. The Reference variant's data shape is defined but composite/sampling integration is deferred to issue 110. From the user's point of view this slice is dead-code — main is unaffected.

Scope:

- `Layer { id: Uuid, name: String, visible: bool, opacity: f32, kind: LayerKind }`
- `LayerKind::Pixel(PixelData) | LayerKind::Reference(ReferenceData)`
- `PixelData` owns the current `PixelCanvas` pixel buffer (preserves existing behavior).
- `ReferenceData` carries the decoded source RGBA buffer, the natural width/height (preserved for "Restore original size"), and a `ReferencePlacement` (forward declaration — full type lives in 108).
- `Document::composite()` keeps its existing behavior: Pixel Layers blend source-over; Reference Layers contribute nothing yet (placeholder branch). All existing composite tests still pass.
- All existing Document/Layer tests still pass, with mechanical updates to constructor calls if needed.
- Inline unit tests verify mixed-kind documents preserve every layer's kind across snapshot round-trips.

This slice contains the **deep-module test for `LayerKind` enum branching** (testing decisions §1, #3): the kind-aware pattern matches are exercised at the type-level here, and the integration-level branching arrives in 110 once the sampler is wired.

## Acceptance criteria

- `Layer` is defined as `{ id, name, visible, opacity, kind: LayerKind }`.
- `LayerKind::Pixel(PixelData)` and `LayerKind::Reference(ReferenceData)` exist.
- `PixelData` retains the existing `PixelCanvas` API (no public-surface regression for callers).
- `ReferenceData` carries `source_rgba`, `natural_width`, `natural_height`, and a placement field.
- All existing `cargo test` cases pass under the new shape.
- A new inline unit test verifies mixed-kind documents preserve each layer's kind through a snapshot round-trip.
- No WASM facade or TS interface changes — the binding still sees Pixel-shaped layers only.

## Blocked by

None — can start immediately.

## User stories addressed

- Foundation for #2, #18, #20 (dead-code yet).
