---
title: "Seal Reference Layer Placement Invariants into the Core"
status: ready-for-agent
created: 2026-06-10
---

## Problem Statement

The Reference Layer Placement invariant — finite `x`/`y`, scale finite and strictly greater than 0 — is enforced at the WASM adapter instead of where the data lives:

- `crates/core/src/reference_placement.rs` exposes bare `pub x / y / scale: f32` fields with no validating constructor. Any core caller can construct or mutate an illegal placement; `sample_reference` divides by `scale` and cannot defend itself without violating "fail at the boundary, trust the core".
- `wasm/src/lib.rs` owns the rules (`is_valid_reference_scale` / `validate_reference_placement`) and applies them at two of three construction entry points: `set_reference_placement` and `add_reference_layer` validate, but the JS-exposed `WasmReferencePlacement` constructor does not — an unvalidated hole into the same type.
- A second adapter (UniFFI, when the Apple shell adopts Reference Layer) would have to re-implement the same rules; the current seam makes that duplication structural.
- `sample_reference` is a free function over raw parts (`source_rgba`, `source_dims`, `placement`) even though `ReferenceData` owns exactly that data — rust-conventions prefer behavior on the type.

Folds two review-backlog items: "Validate `ReferencePlacement.scale` invariant" (flagged by greptile/coderabbit/cubic on PR #208) and "Collapse `sample_reference` free function into `ReferenceData::sample_at(x, y)`". Implements architecture-review candidate 5 (2026-06-10).

## Solution

Make illegal placements unrepresentable in the core; adapters shrink to marshalling.

### Interface reshape (sketch)

```rust
// crates/core/src/reference_placement.rs
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ReferencePlacement { x: f32, y: f32, scale: f32 } // fields go private

impl ReferencePlacement {
    /// The only public way to build from raw components; enforces the invariant.
    pub fn new(x: f32, y: f32, scale: f32) -> Result<Self, ReferencePlacementError>;
    pub fn x(&self) -> f32;  pub fn y(&self) -> f32;  pub fn scale(&self) -> f32;

    pub fn fit_to_canvas(...) -> Self;  // kept — valid by construction
    pub fn auto_fit(...) -> Self;       // moved from document.rs `auto_fit_placement` —
                                        // the never-enlarge (scale ≤ 1) sibling of fit_to_canvas
    pub(crate) fn with_position(self, x: f32, y: f32) -> Self; // internal builder;
                                        // sole caller is the document resize translation
    // with_scale removed — test-only usage, no production caller
}

/// Display + std::error::Error, message texts equivalent to today's adapter errors.
pub enum ReferencePlacementError { NonFiniteCoordinates { .. }, InvalidScale { .. } }

// crates/core/src/layer.rs
impl ReferenceData {
    /// Replaces the `reference_sampler::sample_reference` free function.
    pub fn sample_at(&self, x: u32, y: u32) -> Option<Color>;
}
```

### Adapters shrink to marshalling

- wasm: `is_valid_reference_scale` / `is_valid_reference_placement` / `validate_reference_placement` deleted. `set_reference_placement` and `add_reference_layer` call `ReferencePlacement::new(...)` and marshal the `Err` into `JsError` — same rejection points, equivalent messages ("coordinates must be finite" / "scale must be finite and greater than 0").
- `WasmReferencePlacement`'s JS constructor is deleted: no TS caller exists (TS consumes only `fit_to_canvas` and the getters), and removal closes the unvalidated hole instead of validating it.
- `crates/core/src/reference_sampler.rs` module removed; `Document::try_get_pixel` calls `data.sample_at(x, y)`.
- Apple adapter: no change today (no Reference Layer support). When UniFFI exposes placement, it marshals into `ReferencePlacement::new` instead of duplicating rules — the payoff of this seam move.

### Behavior

- **Preserved**: same invariant, same rejection entry points, equivalent error messages. No TS-visible behavior change — no TS code constructs `WasmReferencePlacement` or depends on the message text.
- **Strengthened**: illegal placements that were representable inside the core (struct literal, direct field mutation, the unvalidated wasm constructor) become compile errors or `Err`. `sample_at`'s division by `scale` becomes genuinely safe to trust.

### Test migration

- The two wasm validator unit tests move to core `ReferencePlacement::new` tests (NaN/±∞ coordinates; 0 / negative / NaN / ±∞ scale).
- `reference_sampler.rs` tests (9) migrate to `ReferenceData::sample_at` through the public type.
- Core test struct literals (`ReferencePlacement { x, y, scale }` across `document.rs` / `layer.rs` / `reference_placement.rs` tests) become `ReferencePlacement::new(...).unwrap()` — wide but mechanical.
- `fit_to_canvas` / builder / wasm seam tests survive, adjusted to getters.

### Out of scope

- New invariants beyond today's rules (no max-scale clamp, no canvas-relative bounds).
- TS changes beyond regenerated wasm bindings.
- UniFFI exposure of Reference Layer (future Apple work).
- `cargo fmt` debt in `wasm/src/lib.rs` (separate backlog item).

## Decisions (planning, 2026-06-10)

| Branch | Decision |
|---|---|
| Invariant boundary | Validating `ReferencePlacement::new` in core; fields private with getters |
| Error type | `ReferencePlacementError` enum, `Display` + `std::error::Error`, messages equivalent to today's |
| `auto_fit_placement` | Moves onto the type (field privacy forces it; it is `fit_to_canvas`'s never-enlarge sibling) |
| `with_position` / `with_scale` | `pub(crate)` (one internal caller) / deleted (test-only) |
| `WasmReferencePlacement` JS constructor | Deleted — unused from TS, closes the unvalidated hole by removal |
| `sample_reference` | Becomes `ReferenceData::sample_at`; `reference_sampler.rs` removed, tests migrate to the method |
