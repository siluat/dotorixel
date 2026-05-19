---
title: "Reference Layer: Rust core — nearest-neighbor sampler"
status: done
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

A pure function (or inherent method) that, given a source RGBA buffer, its dimensions, a `ReferencePlacement`, and a document `(x, y)` coordinate, returns the source pixel at that document coordinate via nearest-neighbor (integer-floor) sampling — or `None` if the document coordinate is outside the source's projected footprint. **Deep-module unit tests required** (testing decisions §1, #2).

Scope:

- Signature roughly: `sample_reference(source_rgba: &[u8], source_dims: (u32, u32), placement: &ReferencePlacement, x: u32, y: u32) -> Option<Color>`.
- Integer-floor sampling — appropriate for pixel-art aesthetic; no smoothing.
- No Document coupling, no IO.
- Inline unit tests over small fixture RGBA buffers, table-driven where natural.

## Acceptance criteria

- 1:1 placement (scale=1.0, position=0,0): each document pixel maps to the corresponding source pixel.
- Integer scale-up (2x, 3x): each scaled pixel returns the correct source pixel.
- Scale-down by half: floors to the correct source pixel.
- Sub-pixel offsets snap to the integer source coordinate (no smoothing).
- Out-of-source coordinates (outside the projected footprint) return `None`.
- Edge pixels (last row / last column) are reachable, not clipped by an off-by-one.
- All cases covered as inline unit tests in `crates/core/`.

## Blocked by

None — can start immediately.

## User stories addressed

- Foundation for #16.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/reference_sampler.rs` | New deep module — `sample_reference` free function + 8 inline unit tests covering every AC plus a negative-floor regression case |
| `crates/core/src/lib.rs` | Registered `pub mod reference_sampler` |

### Key Decisions

- **Free function over inherent method on `ReferencePlacement`** — placement, source buffer, source dims, and document coord are equally inputs; there is no natural receiver. Rust conventions explicitly allow free functions when no polymorphism is needed.
- **No re-export at `lib.rs` root** — project convention re-exports types only (struct/enum/trait), never free functions. Future internal callers (Document.composite) use `crate::reference_sampler::sample_reference`.
- **Float bounds check before u32 cast** — `((doc - placement) / scale).floor()` can produce negative values; Rust's saturating float→u32 cast silently maps these to 0, which would falsely sample source(0, 0) for out-of-footprint coords. The `< 0.0` guard runs on the f32 before the cast.

### Notes

- The function trusts its caller for `source_rgba` length (≥ `width × height × 4`). Document is the only intended call site and will pass correctly-sized buffers. Aligns with project rule "fail at the boundary, trust the core".
- Still dead code at the shell — first user-visible caller arrives with #110 (Document add/composite paths).
