---
title: "Reference Layer: export call sites use `composite_for_export()`"
status: done
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

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Export snapshots now use the Pixel-only composite path shared by PNG and SVG export. |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | Added a mixed Pixel + Reference Layer regression test proving export pixels exclude visible Reference Layers while the on-screen composite still includes them. |

### Key Decisions

- Kept PNG and SVG behind the existing export snapshot boundary, so the export-only behavior is centralized instead of duplicated per format.

### Notes

- Saved-work thumbnails already used the Pixel-only summary path from 115; the existing thumbnail regression test was re-run with this task.

### Amendment (2026-05-22)

PRD-105 was corrected: Reference Layer is no longer part of the on-screen `Document.composite()` path. The export exclusion remains correct, but tests and descriptions should not assume that `composite()` includes Reference pixels. Export, thumbnail, and `Document.composite()` are all Pixel-only under the corrected model; viewport rendering draws Reference separately as an underlay.
