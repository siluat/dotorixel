---
title: "Batch layer metadata across the WASM seam"
status: done
created: 2026-06-07
---

## What to build

Replace the per-index, per-field layer accessors on the `Document` seam with a single
`layers_metadata()` that returns every layer's record in one call. Today, reading one
layer's metadata fans out into up to eight separate `layer_*_at(i)` crossings
(`layer_id_at`, `layer_name_at`, `layer_visible_at`, `layer_opacity_at`, `layer_kind_at`,
plus the Reference-only `layer_source_fingerprint_at`, `layer_source_dimensions_at`,
`layer_placement_at`), reassembled in TS — and `DocumentLayerProjection.read()` does this
for every layer on every projection refresh.

After this change, `WasmDocument.layers_metadata()` returns `WasmLayerMetadata[]` — one
record per layer carrying `{ id, name, visible, opacity, kind }` plus the Reference-only
fields (`sourceFingerprint`, `naturalWidth`, `naturalHeight`, `placement`) as optionals.
The eight fine-grained metadata accessors are removed from both the `Document` interface
and `WasmDocument`. The bulk pixel accessors (`layer_pixels_at`, `layer_source_pixels_at`)
stay separate and on-demand — bulk RGBA buffers must not be eagerly copied into every
metadata read.

## Design decisions (settled up front)

- **Getter-struct serialization, not serde.** `WasmLayerMetadata` is a `#[wasm_bindgen]`
  getter struct, matching the existing `WasmColor` / `WasmReferencePlacement` /
  `WasmMarqueeRegion` convention. No `serde-wasm-bindgen` — that dependency stays deferred
  until the JSON file-format work needs it (`tasks/todo.md`). The real win here is
  **interface shrink + locality (one Layer-record shape) + a single structured read**, not
  a raw FFI-crossing reduction: `read()` is cached by `renderVersion` and layer counts are
  small, so per-field getter crossings are not a measured bottleneck. The headline
  "10 → 1 crossings" is honestly delivered as "8 fine-grained accessors → 1 structured
  accessor."
- **Full deepening, not projection-only.** Every metadata consumer migrates and the eight
  accessors are deleted, so the seam interface genuinely shrinks (consistent with the
  157–162 deepening campaign). The deletion test holds: removing `layers_metadata()` forces
  every consumer back to a fan-out, so it concentrates complexity rather than moving it.
- **Web-only; core untouched.** `Document::layers()` and the per-field data already exist in
  the Rust core; batching is a seam concern assembled in the `wasm` crate. The Apple shell's
  single `PixelCanvas` API is unaffected (per the architecture review's ADR note).

## Scope

- New `WasmLayerMetadata` getter struct + `WasmDocument::layers_metadata() -> Vec<WasmLayerMetadata>`
  in `wasm/src/lib.rs`, assembled from `self.inner.layers()` (id/name/visible/opacity/kind)
  and the Reference payload (fingerprint as hex, natural dimensions, placement).
- TS `Document` interface: add `layers_metadata(): LayerMetadata[]`; remove the eight
  fine-grained metadata getters. Define the `LayerMetadata` read type.
- Migrate consumers to `layers_metadata()`:
  - `document-layer-projection.ts` — `read()` + `#projectReferenceLayerUnderlay` become one
    structured read mapped in pure TS.
  - `floating-selection-lifecycle.ts` — compositing loop.
  - `tab-state.svelte.ts` — `TabSnapshot` builder and the single reference-field read.
  - `stroke-engine.ts` / `selection-tool.ts` — active-layer-kind query.
  - `document-change-journal.svelte.ts` — single placement read.
  - `wasm-backend.ts` `activeLayerPixels` — id→index via the record array, then bulk pixels.
  - `fake-drawing-ops.ts` test double — implement `layers_metadata()` in place of the eight
    accessors.
- Update affected tests (hydration, journal, tab-state, tool-runner, selection-tool,
  session-persistence) to the new surface.
- Keep `layer_pixels_at` / `layer_source_pixels_at` (bulk, on-demand) and `layer_count()`.

## Acceptance criteria

- `WasmDocument` and the `Document` interface expose `layers_metadata()` and no longer
  expose any `layer_*_at` metadata accessor (the two bulk pixel accessors remain).
- The `WasmDocument satisfies Document` structural-compat check still compiles
  (`wasm-sync.test.ts`).
- Reference fields are present only on Reference-layer records and `undefined` on Pixel
  records; values are equivalent to the previous per-field accessors (fingerprint hex
  format, `[naturalWidth, naturalHeight]`, placement `x`/`y`/`scale`).
- A Rust test covers `layers_metadata()` over a mixed Pixel + Reference stack (ordering,
  fields, Reference-only optionals).
- `DocumentLayerProjection.read()` produces an identical `DocumentLayerProjectionRead` for
  the same document as before (regression-covered).
- `cargo test` (core + wasm) green; `svelte-check` clean; unit + e2e suites pass; production
  build OK.

## Blocked by

None — sourced from the architecture review (`/improve-codebase-architecture`, candidate #2).
Sibling candidate #3 (Loupe geometry, #162) is already done. Standalone seam refactor.

## Results

| File | Description |
|------|-------------|
| `wasm/src/lib.rs` | New `WasmLayerMetadata` getter struct + `WasmDocument::layers_metadata()` (assembled from `inner.layers()`); removed the eight fine-grained `layer_*_at` metadata accessors; migrated the wasm unit tests to the batched reader. |
| `src/lib/canvas/canvas-model.ts` | Added the `LayerMetadata` read type + `Document.layers_metadata()`; removed the eight metadata getter declarations. Bulk `layer_pixels_at` / `layer_source_pixels_at` and `layer_count` retained. |
| `src/lib/canvas/document-layer-projection.ts` | `read()` and the Reference-underlay projection now consume one `layers_metadata()` read mapped in pure TS; the source-RGBA cache (keyed by id/fingerprint/dims) is preserved exactly. |
| `editor-session/floating-selection-lifecycle.ts`, `editor-session/tab-state.svelte.ts`, `stroke-engine.ts`, `tools/selection-tool.ts`, `editor-session/document-change-journal.svelte.ts`, `wasm-backend.ts` | Migrated every metadata consumer — preview compositing loop, `TabSnapshot` builder + fit-to-canvas, active-layer-kind guards, set-reference-placement guard, and `activeLayerPixels` id→index lookup. |
| `fake-drawing-ops.ts` + hydration / journal / tab-state / tool-runner / selection-tool / session-persistence tests | Test double implements `layers_metadata()`; test call sites and inline `Document` mocks migrated to the batched surface. |

### Key Decisions

- **Getter-struct serialization, not serde.** Chose `Vec<WasmLayerMetadata>` getter structs (matching `WasmColor` / `WasmReferencePlacement`) over introducing `serde-wasm-bindgen`, which stays deferred until the JSON file-format work needs it. Honest framing: the real win is **interface shrink + locality (one Layer-record shape) + a single structured read**, not a raw FFI-crossing reduction — `read()` is `renderVersion`-cached and layer counts are small, so per-field getter crossings were never the bottleneck. `kind` stays a `string` (narrowed at the boundary by `normalizeLayerKind`) because the binding can't emit a TS union without a wasm enum.
- **Full deepening.** Migrated all consumers and deleted the eight accessors so the seam genuinely shrinks, consistent with the 157–162 deepening campaign. The deletion test holds.
- **Core untouched.** Assembly lives in the `wasm` crate from `Document::layers()` + existing Reference accessors; the core's per-field API is unchanged and the Apple `PixelCanvas` API is unaffected.

### Notes

- **Behavior-preserving.** The projection regression test (`document-layer-projection.test.ts`) was left unchanged and stayed green, including the `layer_source_pixels_at` cache-spy assertion.
- **Verified.** `cargo test` 357 (core) + 20 (wasm) · `svelte-check` clean · unit 1358 · e2e 88 · production build OK · markdownlint clean.
- **Real-browser smoke test** (reference layers + draw-on-reference guard): import → underlay renders; draw blocked on a Reference-active layer and works on a Pixel layer; visibility hide→show restores the underlay pixel-for-pixel (0.01% diff, the cache re-fetch path); placement move + fit-to-canvas both behave.
- Architecture-review candidates **#4 (concentrate undoable-intent handling), #5 (extract Marquee math), #6 (reference-image lifecycle)** remain open follow-ups.
