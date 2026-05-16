---
title: "Reference Layer: Rust core — `ReferencePlacement` value type"
status: needs-triage
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
