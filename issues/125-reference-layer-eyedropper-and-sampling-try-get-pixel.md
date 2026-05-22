---
title: "Reference Layer: eyedropper and Canvas Sampling remain Pixel-layer reads"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Re-align eyedropper and Canvas Sampling Sessions with the corrected Reference Layer model: Reference is a viewport underlay, not a document pixel buffer. For v1, eyedropper and sampling continue to read Pixel Layer/document pixel data only. When the Reference Layer is active, sampling should no-op clearly and quietly rather than sample from the reference source or fall through to a hidden composite.

This replaces the earlier plan to route Reference-active sampling through `Document.try_get_pixel` and the nearest-neighbor sampler.

Scope:

- Eyedropper/Sampling Sessions use an optional read path for Pixel Layer/document pixel data: in-bounds pixel -> commit color; no readable pixel -> no-op.
- With Reference active, eyedropper and sampling do not sample the Reference source image in v1.
- With Reference active, no color is committed, recent colors are not updated, and no error toast/console error appears.
- With Pixel active, existing eyedropper and sampling behavior remains unchanged except where out-of-bounds reads are made explicitly optional/no-op.
- No fall-through to lower Pixel Layers or viewport composite.
- Leave an implementation note for future Reference source sampling: if added later, it should use an explicit source-image sampler and product decision, not `Document.composite()`.

## Acceptance Criteria

- With Pixel active, eyedropper inside document bounds commits the sampled color.
- With Pixel active, out-of-bounds sampling is a silent no-op.
- With Reference active, eyedropper/sampling over the underlay is a silent no-op in v1.
- Reference-active sampling does not mutate FG/BG color and does not update recent colors.
- No Reference source pixels are read through `Document.composite()`.
- No error toast or console error on silent-no-op cases.
- Tests cover Pixel-active success, Pixel-active optional/no-op, and Reference-active no-op.

## Blocked By

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)
- [124 — drawing tools no-op + cursor](124-reference-layer-drawing-tools-no-op-and-cursor.md)

## User Stories Addressed

- Keeps sampling behavior safe under #16. Reference source sampling is intentionally out of scope.
