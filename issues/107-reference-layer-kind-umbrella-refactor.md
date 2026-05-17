---
title: "Reference Layer: Rust core — `Layer` umbrella refactor (`LayerKind::Pixel | Reference`)"
status: done
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

## Results

| File | Description |
|------|-------------|
| `crates/core/src/reference_placement.rs` (new) | `ReferencePlacement { x, y, scale: f32 }` value type — public fields, `Copy`. Constructor and value-type builders deferred to 108. |
| `crates/core/src/layer.rs` | Refactored to `Layer { id, name, visible, opacity, kind: LayerKind }` with `LayerKind::Pixel(PixelCanvas) \| Reference(ReferenceData)`. Added `ReferenceData` (private fields, validating `new`, getters + `set_placement`) and `ReferenceDataError { InvalidDimension, InvalidBufferLength }` implementing `Display + std::error::Error`. `Layer::new` constructs `LayerKind::Pixel`. |
| `crates/core/src/document.rs` | All active-layer methods (`get_pixel`, `set_pixel`, `apply_tool`, `flood_fill`, `clear`, `restore_active_layer_pixels`) `match` on `kind` with `unreachable!("active layer must be a Pixel Layer")` for Reference. `composite` skips Reference. `from_layers` skips dimension check for Reference. `resize` carries Reference through unchanged. `layer_pixels_at` returns `None` for Reference. Renamed `blend_layer_over` → `blend_pixel_canvas_over(&mut [u8], &PixelCanvas, f32)`. Added test helpers `pixel_canvas` / `set_pixel_canvas` + 4 regression tests. |
| `crates/core/src/history.rs` | Added test-module helper `pixel_canvas`; migrated 2 test sites. |
| `crates/core/src/lib.rs` | Re-export `reference_placement::ReferencePlacement`. |
| `wasm/src/lib.rs` | `WasmDocumentBuilder::add_layer` wraps the canvas as `LayerKind::Pixel`. Public wasm-bindgen signature unchanged. |

### Key Decisions

- **`Layer { kind: LayerKind }` umbrella, not `enum Layer { Pixel{...}, Reference{...} }`.** Keeps the common slot fields (`id`, `name`, `visible`, `opacity`) shared without duplication and avoids forcing every Document loop to re-extract them.
- **No intermediate `PixelData` wrapper.** `LayerKind::Pixel(PixelCanvas)` directly — `PixelCanvas` already encapsulates the pixel buffer; an extra wrapper would have been a pass-through with no behavior.
- **`ReferenceData::new` validates `source_rgba.len() == natural_width × natural_height × 4` and dims ≥ 1.** Construction is the only boundary — internal `set_placement` then trusts callers per the project's "fail at the boundary" rule.
- **`ReferencePlacement` lives in its own module** (`reference_placement.rs`) so future constructors and builders land alongside it without growing `layer.rs`.
- **Pixel-active invariant locked in by `unreachable!`.** No UI/wasm path can make a Reference Layer active yet; the panic guards a future regression and pairs with the dead-code scope of this slice.

### Notes

- This slice is dead-code at the user surface: `WasmDocumentBuilder::add_layer` only constructs Pixel layers, so neither Web nor Apple shells see `LayerKind::Reference` yet. Composite/sampling integration arrives in 110.
- All 288 `dotorixel-core` tests and 12 `dotorixel-apple` tests pass on the post-refactor shape.
- 4 new regression tests: `composite_excludes_reference_layers`, `from_layers_preserves_kind_and_data_in_mixed_document`, `layer_pixels_at_returns_none_for_reference_layer`, `resize_carries_reference_layers_through_unchanged`.
