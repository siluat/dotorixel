---
title: "Layer system: Document builder + tool bindings + TS facade"
status: ready-for-agent
created: 2026-05-08
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Complete the Document FFI surface — the missing plumbing that 091 needs in order to
swap `pixelCanvas: PixelCanvas` for `document: Document` in `TabState`. After 087–090,
three gaps remain that 091 cannot finish atomically:

1. **No multi-layer hydration path.** `Document::new(width, height)` always creates a
   single fresh transparent layer. Restoring a saved V3 record (or a migrated V2
   record) needs a constructor that accepts an already-built layer stack with caller-
   supplied UUIDs, names, pixels, visibility, and opacity.
2. **Document mutators do not yet cover the tool surface.** `WasmDocument` exposes
   `set_pixel`, but the existing TS shell drives drawing through `apply_tool` and
   `flood_fill` against `WasmPixelCanvas`. Without Document-level equivalents, the
   `TabState` switch in 091 has nowhere to route tool effects.
3. **No TS-side Document facade.** The TS shell talks to canvases through a
   structural `PixelCanvas` interface (so unit tests can substitute a fake without
   touching WASM). No equivalent exists for `WasmDocument`, so 091 has no seam for
   either DI or testing.

This issue is plumbing only — no call site in `main` changes. The slice remains
dead code until 091 wires it into `TabState`.

### Scope

#### Rust core (`crates/core/`)

- Add `Document::from_layers(width, height, layers, active_layer_id,
  next_layer_number, timeline_panel_collapsed) -> Result<Document,
  DocumentBuildError>`.
  - Validates: non-empty layer stack, unique UUIDs, every layer's pixel canvas
    matches the document dimensions, `active_layer_id` resolves to one of the
    supplied layers.
- Add `DocumentBuildError` enum implementing `Display` + `std::error::Error`
  (variants: `EmptyLayers`, `DuplicateLayerId(Uuid)`, `LayerDimensionsMismatch`,
  `UnknownActiveLayer(Uuid)`).
- Add Document-level tool mutators that delegate to the active layer's pixel
  canvas:
  - `apply_tool(...)` — same signature shape as `PixelCanvas::apply_tool`.
  - `flood_fill(...)` — same signature shape as `PixelCanvas::flood_fill`.
  - `clear()` — fills the active layer with transparent.
- Add `Document::layer_pixels_at(index) -> Option<&[u8]>` (read-only borrow of the
  full RGBA buffer for that layer; needed by the save path to serialize each
  layer back into a `LayerRecord`).

#### WASM facade (`wasm/src/`)

- Add `WasmDocumentBuilder`:
  - `new(width, height) -> WasmDocumentBuilder`
  - `add_layer(id: String, name: String, pixels: Vec<u8>, visible: bool,
    opacity: f32) -> Result<(), JsError>` — accumulates a single layer.
  - `build(active_layer_id: String, next_layer_number: u32,
    timeline_panel_collapsed: bool) -> Result<WasmDocument, JsError>` —
    consumes the builder and runs `Document::from_layers` validation.
  - This pattern sidesteps `wasm-bindgen`'s lack of native `Vec<MyType>`
    marshalling without pulling in `serde-wasm-bindgen`.
- Extend `WasmDocument` with:
  - `apply_tool(...)`, `flood_fill(...)`, `clear()` — bindings for the new core
    delegators.
  - `layer_pixels_at(index: u32) -> Option<Vec<u8>>` — returns a copied RGBA
    buffer for the layer at the given index (TS save path consumes this).

#### TS facade (`src/lib/canvas/`)

- Add a `Document` structural interface that mirrors the `WasmDocument` surface
  needed by callers (renderer, tools, history, persistence): `width`, `height`,
  `composite()`, `setPixel`, `applyTool`, `floodFill`, `clear`, `addLayer`,
  `removeLayer`, `reorderLayer`, `setActiveLayer`, `resize`, `activeLayerId`,
  `nextLayerNumber`, `isTimelinePanelCollapsed`, `layerCount`, `layerIdAt`,
  `layerNameAt`, `layerVisibleAt`, `layerOpacityAt`, `layerPixelsAt`.
- Provide an implementation backed by `WasmDocument` (thin adapter; methods
  forward 1:1).
- Add a hydration helper `documentFromSchemaV3(schema: DocumentSchemaV3):
  Document` that calls `WasmDocumentBuilder` for each `LayerRecord` and returns a
  ready-to-use `Document`.
- Extend the TS `HistoryManager` facade with `pushDocument(document)`,
  `undoDocument(document)`, `redoDocument(document)` — thin wrappers around the
  WASM document-snapshot methods that 088/089 already shipped.

### Out of scope

- No `TabState` changes — that is 091's body.
- No persistence call-site rewiring — 091 introduces the first read of
  `migrateV2ToV3` and the first write of a V3 record.
- No new tools or new layer mutations beyond what `PixelCanvas` already supports.

## Acceptance criteria

- Rust `Document::from_layers` constructs a multi-layer Document with caller-
  supplied UUIDs and pixel buffers, validates inputs, and returns
  `DocumentBuildError` on each failure mode.
- Rust `Document::apply_tool`, `flood_fill`, `clear` delegate to the active
  layer's `PixelCanvas` and produce identical results to calling those methods
  on a standalone `PixelCanvas` of the same dimensions.
- Rust `Document::layer_pixels_at(index)` returns the RGBA buffer for the layer
  at that index.
- WASM `WasmDocumentBuilder` builds a `WasmDocument` whose `composite()` matches
  the source-over composite of the supplied layer pixel buffers.
- WASM `WasmDocument.apply_tool`, `flood_fill`, `clear`, `layer_pixels_at` are
  callable from TS and surface the underlying core errors as `JsError`.
- TS `Document` facade interface compiles and is implemented over
  `WasmDocument`. A unit test using a hand-written `Document` fake exercises the
  interface end-to-end (no WASM dependency).
- TS `documentFromSchemaV3` round-trips a `DocumentSchemaV3` produced by
  `migrateV2ToV3` into a working `Document` (bytes preserved on every layer).
- TS `HistoryManager` facade gains `pushDocument`/`undoDocument`/`redoDocument`;
  the canvas-path methods remain unchanged.
- `main` is unaffected: no production call site constructs `WasmDocument` or
  the TS `Document` facade. `bun run check` and `cargo test --workspace` pass.

## Blocked by

- [087 — Rust core: Document/Layer + composite + add/delete/reorder](087-layer-system-rust-document-layer-core.md)
- [088 — Rust HistoryManager: Document snapshot support](088-layer-system-rust-history-document-snapshot.md)
- [089 — WASM Document facade](089-layer-system-wasm-document-facade.md)
- [090 — TS V3 schema + migration](090-layer-system-ts-v3-schema-migration.md)

## Scenarios addressed

- Plumbing groundwork for Scenarios 1, 2, 6, 8, 9, 12 — none directly observable
  yet. First user-visible effect lands with 091.

## Notes

- 091's body becomes pure shell-side wiring once this lands. The scope split
  mirrors the 089/090 pattern: each issue carries one well-defined slice of the
  layered FFI stack.
