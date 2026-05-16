---
title: "Reference Layer: Rust core — nearest-neighbor sampler"
status: needs-triage
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
