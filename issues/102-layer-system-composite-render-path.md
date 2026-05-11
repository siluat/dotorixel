---
title: "Layer system: switch main canvas render to `document.composite()`"
status: ready-for-agent
created: 2026-05-11
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Make the main canvas render the full document composite — every visible layer blended bottom-to-top with source-over alpha — instead of mirroring only the active layer's pixels.

Today, `tab-state.svelte.ts` keeps a `pixelCanvas` field that is initialized and updated from `activeLayerPixels(document)`. `+page.svelte` (and the surrounding UI) passes this `pixelCanvas` to the renderer, so anything drawn on a non-active layer is invisible and any layer below the active one is treated as transparent. This contradicts both the PRD's "Document is the sole source of truth" decision and the way users expect layer stacks to behave (Aseprite, Photoshop, Procreate).

Scope:

- Remove the `pixelCanvas` mirror from `TabState` (`tab-state.svelte.ts`). Callers that need width/height/pixels read from `document` directly.
- The main canvas renderer receives a `RenderableCanvas`-shaped wrapper whose `pixels()` returns `document.composite()` (cached per render trigger if the per-frame allocation matters; otherwise unmemoized to keep things simple).
- Tools mutate the active layer through `document.set_pixel` / `document.apply_tool` / `document.flood_fill`. The existing `toolRunner` host indirection stays — only the backing object changes.
- `tab-state.exportPng` already uses `document.composite()` and is unchanged.
- `tab-state.toSnapshot` keeps using `document.composite()` until **103** lands; the persistence format swap is intentionally scoped out of this slice.
- `+page.svelte` callers that currently read `editor.pixelCanvas.width` / `.height` / `.pixels()` switch to `editor.document.width` / `.height` / `editor.document.composite()` (or a thin convenience getter on `TabState` like `compositeBuffer()` if the call sites get noisy).

Out of scope:

- Render performance work (caching the composite, dirty-region invalidation, WebGL2). M3 explicitly defers composite caching until measurement.
- Persistence wiring — owned by **103**.
- Visibility toggle UI — owned by **097** (this slice only ensures the renderer respects `visible === false`, which the Rust composite already does).

## Acceptance criteria

- With two layers — bottom: opaque red, top: partially-transparent blue (e.g. `rgba(0, 0, 255, 128)`) — the canvas shows the source-over blend on screen, not the top layer alone over the checkerboard.
- After clicking "+ add layer", drawing on the new (now-active) layer immediately shows the stroke on top of whatever was visible before. Switching the active layer back to a lower one does not erase the upper layer from the canvas.
- A layer with `visible = false` does not contribute to the composite (already covered by the Rust unit test; this slice locks the wiring path end-to-end).
- Pixel Perfect e2e and other existing canvas-render e2e/component tests still pass against the composite path (no regression for single-layer documents).
- `TabState` no longer exposes a `pixelCanvas` field. Any test or call site referencing it is migrated.

## Blocked by

- [094 — Add-layer button](094-layer-system-add-layer-button.md) — provides the only existing entry point to create a second layer, which this slice's manual and e2e verification both rely on.

## Scenarios addressed

Prerequisite for visual verification of Scenarios 5 (reorder), 6 (undo across layer changes), 7 (visibility toggle), and 11 (mobile Timeline tab). Directly satisfies the rendering half of Scenario 2 ("draw applies to the active layer") by making non-active layers visible while the active layer accepts the stroke.
