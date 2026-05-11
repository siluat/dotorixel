---
title: "Layer system: V3 multi-layer pixel persistence wiring"
status: ready-for-agent
created: 2026-05-11
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Connect `DocumentSchemaV3` (already declared in `session-storage-types.ts` by 090) to the IndexedDB read/write path so that the full multi-layer document — per-layer pixels, per-layer metadata, the active-layer pointer, the layer-number counter, and the timeline panel state — survives page refresh.

Today the schema exists as a type but no code reads or writes V3: `SessionStorage` is typed as `DocumentRecord = DocumentSchemaV2`, `tab-state.toSnapshot()` serializes `pixels: this.document.composite()` into a single flat buffer, and hydration rebuilds documents as single-layer via `singleLayerDocument(...)`. Every multi-layer add/draw/reorder/visibility-toggle made in 094 and the upcoming 095–099 slices is silently flattened on the next session.

Scope:

- **Types** (`src/lib/session/session-storage-types.ts`):
  - Extend `StoredDocument` union to `V1 | V2 | V3`.
  - Repoint `DocumentRecord` to `DocumentSchemaV3`.
  - Update `SavedDocumentSummary` shape if/where it leaks V2-only assumptions (`pixels: Uint8Array`). A summary may keep a single thumbnail buffer derived from the V3 composite to avoid loading every layer for browsing — choose during implementation, but document the choice in the issue notes.
- **Storage** (`src/lib/session/session-storage.ts`):
  - Bump `DB_VERSION` from `2` to `3`.
  - Add an upgrade step that runs a cursor migration applying `migrateV2ToV3` to every existing record.
  - `getDocument` / `putDocument` / `getAllSavedDocuments` operate on V3 records; legacy V1/V2 reads route through `migrateDocumentToV2` → `migrateV2ToV3`.
- **Serialization** (`src/lib/canvas/workspace-snapshot.ts` and/or `tab-state.toSnapshot`):
  - Replace the flat `pixels: document.composite()` shape with a layer-by-layer record matching `LayerRecord[]`: each layer's `id`, `name`, `pixels` (from `document.layer_pixels_at(i)`), `visible` (`document.layer_visible_at(i)`), `opacity` (`document.layer_opacity_at(i)`), plus `activeLayerId`, `nextLayerNumber`, and `timelinePanelCollapsed` at the document level.
- **Hydration** (the path that builds a `Document` from a stored record — likely in `wasm-backend.ts` / workspace boot):
  - Use `WasmDocumentBuilder` to assemble a multi-layer `Document` from `LayerRecord[]` + `activeLayerId` + `nextLayerNumber` + `timelinePanelCollapsed`. The builder already exists (see `wasm/src/lib.rs:415-480`).

Out of scope:

- The `timelinePanelCollapsed` chevron UI itself — owned by **099** / **100**. This slice only ensures the field round-trips through V3.
- History snapshots — `HistoryManager.push_document` is in-memory; this slice does not change history semantics.

## Acceptance criteria

- Open a fresh document, add three more layers (total 4), draw a distinct mark on each, reorder one of them, toggle one's visibility off (once 097 is in; otherwise verify visibility round-trips via a unit test instead of UI), then refresh the page. The reloaded document has 4 layers in the same order, each with its drawn pixels intact, the same `activeLayerId`, the same `nextLayerNumber`, and the same visibility flags. The composite on screen is bitwise identical to the composite before refresh (modulo numeric blending precision on the boundary cases that already have unit-test coverage).
- A V2 document stored in IndexedDB from before this slice upgrades to V3 on the next open: one layer named "Layer 1" with the original pixel buffer, `activeLayerId` set to that layer, `nextLayerNumber = 2`, `timelinePanelCollapsed = false`. No pixel data is lost.
- `getAllSavedDocuments` returns summaries that render correctly in the saved-work browser for both freshly-saved V3 documents and migrated V2 documents.
- `SessionStorage` integration tests cover: V1 record → V3 round-trip, V2 record → V3 round-trip, V3 record → V3 round-trip (no double-migration), and rejection of a malformed V3 record (e.g. `activeLayerId` not present in `layers[]`).

## Blocked by

- [094 — Add-layer button](094-layer-system-add-layer-button.md) — required only as the existing entry point that creates a non-trivial multi-layer document for end-to-end verification. The wiring itself does not depend on 094, so this slice can be developed in parallel with 095/096/097 once 094 is in.

## Scenarios addressed

- Scenario 8 — "When the user adds a layer, draws, then refreshes the page → the next session restores the same Document state (V3 persistence)."
- Scenario 9 — "When an existing V2 user opens the page → the single canvas is auto-migrated to a V3 Document with one Layer 1 (no pixel loss; history is reset)."
- Partial coverage of Scenario 10 — the `timelinePanelCollapsed` field round-trips through V3 here; the chevron UI and per-document recall is owned by 099/100.
