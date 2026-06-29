---
title: "Reference Footprint — one core authority for the projected AABB (core + WASM + web)"
status: ready-for-agent
created: 2026-06-29
---

## Background

Surfaced by an `/improve-codebase-architecture` review (candidate #1) and designed
through a full grilling pass. A Reference Layer's **projected footprint** — the
rotation-aware axis-aligned bounding box of its source image on the Document canvas —
is computed by a formula that lives in **two places** and must stay in sync:

- **Core**, inside the private `rotate_reference_placement` (`crates/core/src/document.rs:1203-1207`):
  `let (bbox_w, bbox_h) = if placement.rotation() % 2 == 0 { (w, h) } else { (h, w) }`.
- **Web**, in `rotatedFootprintExtent` (`src/lib/canvas/reference-layer-underlay.ts:80-82`):
  the same width/height swap on an odd quarter-turn, fed to both Navigation Bounds and
  the underlay's render rect.

The swap is wrong only for rotated references — a classic hiding bug — exactly the kind
of subtle geometry the Core Placement criteria want in one authoritative implementation.
The consumer seams are **already** the right shape: `viewport.clamp_pan_to_document_bounds`
and the web `navigationBounds(canvas, referenceFootprint)` both take a rectangle as input
(the latter's doc comment even anticipates this work — "reference-geometry consolidation").
What is missing is a single **producer** of that rectangle.

## What to build

Introduce one core authority for the projected footprint, route both Navigation Bounds
and the render extent through it, and delete the web's duplicate formula.

- **Core** (`crates/core/src/reference_placement.rs`): a new value type **`ReferenceFootprint`**
  (`f32`, stores min/max corners; accessors `min_x/min_y/max_x/max_y` plus `width()`/`height()`),
  and the formula method `ReferencePlacement::footprint(natural_width: u32, natural_height: u32)
  -> ReferenceFootprint` — the rotation-aware projected AABB in canvas-pixel coordinates
  (`min = (x, y)`, extent = source dims × scale, width/height swapped for an odd quarter-turn).
  Same parameter shape as the existing `fit_to_canvas`.
- **Core** (`crates/core/src/layer.rs`): the convenience `ReferenceData::footprint() ->
  ReferenceFootprint`, supplying its own `natural_width`/`natural_height`.
- **Core** (`crates/core/src/document.rs`): `rotate_reference_placement` reuses
  `placement.footprint(..).width()/height()` for its extent/center instead of the inline
  swap, so "how the footprint projects" has one definition inside the core too.
- **WASM** (`wasm/src/lib.rs`): a `WasmReferenceFootprint` getter-struct (f64 `min_x/min_y/
  max_x/max_y`) and `WasmDocument::reference_layer_footprint_at(stack_index) ->
  Option<WasmReferenceFootprint>` — reads the layer at `stack_index`, returns the footprint
  for a Reference Layer or `None` for a Pixel Layer / no placement. Widen `f32 → f64` at the
  facade (the same way `WasmReferencePlacement` already crosses). Granular `_at(index)`
  accessor matching `layer_source_pixels_at`. Read-only; no mutation, no journal intent.
- **Facade** (`src/lib/canvas/canvas-model.ts`): the TS `Document` interface gains
  `reference_layer_footprint_at(stackIndex)` returning a `ReferenceFootprint`-shaped record
  (`{ min_x, min_y, max_x, max_y } | null`, snake-case duck-typed like `placement`/
  `natural_width`). `fake-drawing-ops.ts` implements it; the `wasm-sync` structural check
  keeps facade and binding in lockstep (same path `composite_at` took in 201).
- **Web** (`src/lib/canvas/document-layer-projection.ts`): `#projectReferenceLayerUnderlay`
  calls the accessor once at build time and caches the result as a new
  `projectedBounds: { minX, minY, maxX, maxY }` field on `ReferenceLayerUnderlay`
  (`src/lib/canvas/reference-layer-underlay.ts`).
- **Web** (`src/lib/canvas/reference-layer-underlay.ts`): **delete** `rotatedFootprintExtent`
  and `referenceLayerUnderlayBounds`. `referenceLayerUnderlayDocumentRect`/`ViewportRect` and
  `#activeReferenceFootprint` (`tab-state.svelte.ts:977`) read the cached `projectedBounds`
  (extent = `maxX − minX`, `maxY − minY`). `normalizedQuarterTurn` stays — it is still used by
  the sampling inverse map, which is out of scope (see below). `navigation-bounds.ts` and the
  viewport clamp are **unchanged** (they already take a rectangle).

## Acceptance criteria

- `ReferencePlacement::footprint(nat_w, nat_h)` returns the correct projected AABB across all
  four quarter-turns with a non-square source and `scale ≠ 1` (the odd-turn width/height swap
  is observable); `min` equals the placement origin and `width()`/`height()` match the rotated
  extent.
- `ReferenceData::footprint()` equals `placement().footprint(natural_width, natural_height)`.
- `rotate_reference_placement` behaviour is unchanged — the existing whole-document rotation
  tests (`document.rs:1868`, `:1898`, `:1981`) stay green as the regression guard for the
  internal reuse.
- WASM `reference_layer_footprint_at` returns the footprint for a visible Reference Layer and
  `None` for a Pixel Layer / no placement; the call mutates nothing.
- The web's projected underlay carries `projectedBounds` sourced from the core; Navigation
  Bounds and the underlay render rect are visually identical to today for both unrotated and
  rotated references; `navigationBounds` behaviour is unchanged.
- `rotatedFootprintExtent` and `referenceLayerUnderlayBounds` no longer exist; no second copy
  of the rotation-aware footprint formula remains in the web shell.
- Tests assert via external behaviour (corner/extent values, footprint contents, active-frame
  and active-layer invariance) — never private representation.
- Lands without touching the Apple binding (no Document / Reference Layer there);
  `cargo build --workspace` stays green.

## Design decisions (from grilling)

- **Justified over "leave it duplicated."** The web already holds placement + natural dims for
  rendering, so it could keep computing the AABB locally — but the formula is subtle and already
  written twice. The dedup only pays if **rendering also routes through the core bounds** (else
  `rotatedFootprintExtent` survives for the render rect and the formula stays duplicated, a net
  loss). Scope is therefore "core owns the AABB; nav-bounds **and** render extent consume it."
- **Cache, don't call per frame.** The footprint is viewport-independent, so it is computed once
  per layer-projection rebuild (placement/source change) and cached on the underlay; pan/zoom do
  no WASM work. The realistic hot path — a placement drag — already round-trips to the core, so
  one extra 4-float read is noise.
- **New `f32` value type, not a tuple or `CanvasRect`.** `CanvasRect` is integer-pixel; the
  footprint is fractional. min/max storage + `width()`/`height()` accessors serve both the
  min/max consumer (nav-bounds) and the origin+size consumer (render rect).
- **Formula on `ReferencePlacement`** (owns rotation/scale, takes natural dims as params like
  `fit_to_canvas`); convenience on `ReferenceData` (owns both inputs).
- **Self-contained WASM accessor**, not folded into `WasmLayerMetadata::from_layer` — that
  method is the target of a separate review candidate (#4) and should not be grown here.
- **Domain term recorded.** `ReferenceFootprint` added to `CONTEXT.md` (formalises the previously
  informal "projected footprint").

## Out of scope (sibling candidate)

The **sampling inverse map** `referenceLayerUnderlaySourceCoords` (`reference-layer-underlay.ts:47`)
— document-point → source-pixel, used by the Reference Sampling Session — is a different
operation (inverse projection, not a bounding box) with one consumer, and the core may already
have an equivalent path (`document.rs:755`). File separately as "one authority for the reference
inverse projection" if the duplication is confirmed.

## Blocked by

None — can start immediately. Independent of review candidate #4 (WASM layer-metadata schema).
