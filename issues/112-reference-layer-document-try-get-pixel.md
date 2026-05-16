---
title: "Reference Layer: Rust core — `Document.try_get_pixel` (sampling-aware accessor)"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

A new sampling-aware accessor on `Document` that reads from the active layer regardless of kind. The existing throwing `get_pixel` is retained for callers that genuinely require in-bounds and would treat OOB as a bug.

Signature: `try_get_pixel(x, y) -> Option<Color>`.

- Active Pixel Layer + `(x, y)` inside document bounds → `Some(color)`.
- Active Pixel Layer + `(x, y)` outside document bounds → `None`.
- Active Reference Layer + `(x, y)` inside the source's projected footprint → `Some(color)` (via the nearest-neighbor sampler from 109).
- Active Reference Layer + `(x, y)` outside the footprint or outside the document → `None`.

This is the contract that eyedropper and Canvas Sampling Sessions consume in 125. This slice only adds the Rust API + tests.

## Acceptance criteria

- `Document::try_get_pixel(x, y) -> Option<Color>` exists.
- Behavior matrix above is covered by inline unit tests.
- Existing `get_pixel` (or equivalent throwing accessor) keeps its current signature and behavior — no regression for callers that depend on in-bounds.

## Blocked by

- [110 — Rust core: `add_reference_layer` + composite paths](110-reference-layer-document-add-and-composite-paths.md)

## User stories addressed

- Foundation for #14, #32.
