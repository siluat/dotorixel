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
  - `restore_to_natural(natural_width, natural_height)` — reset width/height to natural while preserving the center point.
  - `with_position(x, y)` / `with_scale(scale)` — value-type builders.
- `Eq` / `Clone` / `Debug` derives as appropriate (per `.claude/rules/rust-conventions.md` "Derive traits when their semantics are unambiguous").
- No IO, no Document coupling.

## Acceptance criteria

- `ReferencePlacement` exists with the methods above.
- `restore_to_natural` preserves the center point (inline unit test).
- Builders are value-pure: input unchanged, new value returned (inline unit test).
- An identity placement is a no-op for sampler queries (verified at integration time in 110; the value-type itself round-trips through Clone / Eq cleanly).
- Inline unit tests cover the deep-module criteria — center preservation, builder purity, derive correctness.

## Blocked by

None — can start immediately.

## User stories addressed

- Foundation for #8, #22.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/reference_placement.rs` | Added `impl ReferencePlacement` with three value-pure builders taking `self` (Copy): `with_position(x, y)`, `with_scale(scale)`, `restore_to_natural(natural_width, natural_height)`. `restore_to_natural` resets `scale = 1.0` while preserving the projected footprint's center via `center = top_left + natural × scale / 2`. Five inline unit tests cover builder purity, center preservation across scale-up/scale-down, and original-placement immutability. |

### Key Decisions

- **Builders take `self` (not `&self`).** Type is `Copy`, so caller-side cost is zero and the value-pure intent reads directly at the call site. Matches Rust idiom for builders on small `Copy` types.
- **No `Eq` derive.** `f32` fields make `Eq` semantically ambiguous (NaN); kept `Debug + Clone + Copy + PartialEq`. Per rust-conventions "Derive traits when their semantics are unambiguous".
- **No `new()` constructor.** 3-field struct with `pub` fields — struct literal at the call site is clearer (field names visible) and no concrete convenience case (e.g., `const` context) justifies the boilerplate yet.
- **No `Default` impl.** Spec doesn't require it; `Document.add_reference_layer` (issue 110) is the canonical construction site and computes auto-fit, so a `Default` would be a misleading second path.
- **`restore_to_natural` doc comment retained.** "Preserves center" is a non-obvious side effect; signature alone doesn't say so. Builders have no doc — their behavior matches their names.
- **Tests express the invariant, not derived numbers.** Center-preservation tests use a `projected_center` helper to assert "center before == center after + scale = 1.0" instead of pinning specific x/y output values. Matches the TDD "test behavior, not implementation" rule and removes multi-line math comments.

### Notes

- Value type is still dead-code at the shell — only `ReferenceData::set_placement` (issue 107) and forthcoming Document paths (issue 110) call these methods. WASM/TS surface unchanged.
- All 293 `dotorixel-core` tests pass; full workspace `cargo check` clean.
- Sampler-query "identity placement is a no-op" remains deferred to issue 110 by spec.
