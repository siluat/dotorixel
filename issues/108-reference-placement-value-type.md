---
title: "Reference Layer: Rust core — `ReferencePlacement` value type"
status: done
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Introduce the `ReferencePlacement` value type. A pure value type that describes where a reference image projects onto the document — position + uniform scale — with the small set of methods the rest of the system needs. **Deep-module unit tests required** (testing decisions §1, #1).

Scope:

- New module (or inline next to `ReferenceData` in `crates/core/src/layer.rs`).
- Fields: position (x, y) + uniform scale. Concrete types settled during implementation (likely `f32` for sub-pixel placement).
- Methods:
  - `fit_to_canvas(canvas_width, canvas_height, natural_width, natural_height)` — aspect-fit source dimensions inside the canvas and center the projected footprint.
  - `with_position(x, y)` / `with_scale(scale)` — value-type builders.
- `Eq` / `Clone` / `Debug` derives as appropriate (per `.claude/rules/rust-conventions.md` "Derive traits when their semantics are unambiguous").
- No IO, no Document coupling.

## Acceptance criteria

- `ReferencePlacement` exists with the methods above.
- `fit_to_canvas` preserves aspect ratio, keeps the projected source within the canvas, centers the result, and allows upscaling.
- Builders are value-pure: input unchanged, new value returned (inline unit test).
- An identity placement is a no-op for sampler queries (verified at integration time in 110; the value-type itself round-trips through Clone / Eq cleanly).
- Inline unit tests cover the deep-module criteria — fitting behavior, builder purity, derive correctness.

## Blocked by

None — can start immediately.

## User stories addressed

- Foundation for #8, #22.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/reference_placement.rs` | Added `impl ReferencePlacement` with value-pure builders taking `self` (Copy): `with_position(x, y)` and `with_scale(scale)`, plus `fit_to_canvas(canvas_width, canvas_height, natural_width, natural_height)`. `fit_to_canvas` computes the aspect-preserving scale from canvas/source dimensions, centers the projected footprint, and allows upscaling. Inline unit tests cover builder purity, downscale fit, upscale fit, and original-placement immutability. |

### Key Decisions

- **Builders take `self` (not `&self`).** Type is `Copy`, so caller-side cost is zero and the value-pure intent reads directly at the call site. Matches Rust idiom for builders on small `Copy` types.
- **No `Eq` derive.** `f32` fields make `Eq` semantically ambiguous (NaN); kept `Debug + Clone + Copy + PartialEq`. Per rust-conventions "Derive traits when their semantics are unambiguous".
- **No `new()` constructor.** 3-field struct with `pub` fields — struct literal at the call site is clearer (field names visible) and no concrete convenience case (e.g., `const` context) justifies the boilerplate yet.
- **No `Default` impl.** Spec doesn't require it; `Document.add_reference_layer` (issue 110) is the canonical construction site and computes auto-fit, so a `Default` would be a misleading second path.
- **`fit_to_canvas` doc comment retained.** Aspect-fit, centering, and upscaling policy are user-visible behavior, and the signature alone does not communicate all of that. Builders have no doc — their behavior matches their names.
- **Tests pin the visible placement contract.** Fitting tests assert representative projected positions and scales for downscale and upscale cases, because these numbers are the observable geometry that downstream rendering consumes.

### Notes

- Value type is the canonical geometry contract for Reference Layer placement. Document paths call it for initial placement and row-level fit-to-canvas actions.
- Core placement tests cover the current value-type contract, and workspace verification is handled by each implementation task.
- Sampler-query "identity placement is a no-op" remains deferred to issue 110 by spec.

### Amendment (2026-05-23)

Issue 119 makes `fit_to_canvas(canvas_width, canvas_height, natural_width, natural_height)` the row action backing API. It computes an aspect-preserving centered placement with upscaling allowed.
