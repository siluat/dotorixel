---
title: "Reference Layer: eyedropper + Canvas Sampling Session use `try_get_pixel`"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Route eyedropper and Canvas Sampling Session reads through `Document.try_get_pixel` so both layer kinds are sampled from the active layer uniformly. Out-of-source-footprint and out-of-document clicks become a **silent no-op** (no color committed to FG/BG, no recent-color list update).

Scope:

- Eyedropper switches from a throwing in-bounds accessor to `Document.try_get_pixel(x, y)`. `None` → no color committed.
- Canvas Sampling Sessions (long-press / mouse loupe / reference-sampling-session) route reads through `try_get_pixel` the same way.
- For a Pixel Layer active: standard sampling. OOB-document click → silent no-op (was already the de-facto behavior; pin it explicitly).
- For a Reference Layer active: the projected source pixel is read through the nearest-neighbor sampler via `try_get_pixel`. Outside the projected footprint → silent no-op.
- No fall-through to lower layers (the "active layer is sampling port" rule applies uniformly across kinds).

## Acceptance criteria

- With Pixel active, eyedropper inside document bounds commits the sampled color. Outside the document is a silent no-op (no FG/BG change, no recent-color update).
- With Reference active, eyedropper inside the source's projected footprint commits the sampled source pixel. Outside the footprint (but inside the document) is a silent no-op.
- Canvas Sampling Sessions (long-press loupe, mouse loupe) observe the same rule across kinds.
- No error toast, no console error on any of the silent-no-op cases.
- A test asserts the `try_get_pixel` contract from both eyedropper and a Sampling Session.

## Blocked by

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)

## User stories addressed

- #14, #32.
