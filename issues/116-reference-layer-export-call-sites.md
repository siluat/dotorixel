---
title: "Reference Layer: export call sites use `composite_for_export()`"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Update every export call site so the rendered output omits Reference Layers. The on-screen composite remains source-over over every visible layer (unchanged); export call sites use the new Pixel-only composite path.

Scope:

- PNG export: switch the source RGBA acquisition from `composite()` to `composite_for_export()`.
- SVG export: same — Pixel Layers only.
- Saved-work thumbnail: same — Pixel Layers only.
- A test that constructs a Document with a visible Reference Layer + at least one Pixel Layer and asserts the export output equals the Pixel-only composite (i.e., the Reference Layer is absent).

The rationale is recorded in `docs/decisions/reference-layer-excluded-from-export.en.md`.

## Acceptance criteria

- PNG export omits Reference Layers (visible or not).
- SVG export omits Reference Layers.
- Saved-work thumbnail omits Reference Layers.
- An integration test asserts: `export(document_with_reference_layer)` equals `export(same_document_with_reference_layer_removed)`.
- On-screen renderer (which uses `composite()`) is unchanged.

## Blocked by

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)

## User stories addressed

- #3, #4.
