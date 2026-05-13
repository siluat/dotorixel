---
title: "Layer system: V3 multi-layer pixel persistence wiring"
status: done
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

## Results

| File | Description |
|------|-------------|
| `src/lib/session/session-storage-types.ts` | `StoredDocument` union extended to `V1 \| V2 \| V3`; `DocumentRecord` repointed to `DocumentSchemaV3`; `SavedDocumentSummary.pixels` repurposed as a composite thumbnail derived from `compositeV3()`. New pure JS source-over `compositeV3(width, height, layers)` (skips invisible, multiplies layer opacity into source alpha) shared by save path + summary path |
| `src/lib/session/session-storage.ts` | `DB_VERSION` bumped `2 → 3`; `onupgradeneeded` adds a cursor-driven migration that runs `migrateDocumentToV2 → migrateV2ToV3` on every existing record; `normalizeToV3()` defends V3 reads against forward-compat callers writing legacy shapes; `getAllSavedDocuments` derives the composite thumbnail through `compositeV3` |
| `src/lib/session/session-persistence.ts` | `save()` serializes the full V3 record (`layers[]` with id/name/pixels/visible/opacity + `activeLayerId` + `nextLayerNumber` + `timelinePanelCollapsed`); `restore()` returns the V3 record unflattened so the hydration path can rebuild a multi-layer `Document` |
| `src/lib/canvas/workspace-snapshot.ts` | `TabSnapshot` shape switched from flat `pixels: Uint8Array` to multi-layer (`layers: readonly LayerRecord[]` + `activeLayerId` + `nextLayerNumber` + `timelinePanelCollapsed`). Existing `width`/`height`/`viewport` fields preserved |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `toSnapshot()` emits the new multi-layer `TabSnapshot` shape by reading `document.layer_count()` + `layer_id_at/name_at/pixels_at/visible_at/opacity_at` + `active_layer_id()` + `next_layer_number()` + `timeline_panel_collapsed()` |
| `src/lib/canvas/wasm-backend.ts` | New `DocumentLayerSource` structural interface + `documentFromLayerSource(source)` helper that hydrates a multi-layer `Document` via `WasmDocumentBuilder`. Accepts both `DocumentSchemaV3` and `TabSnapshot` via structural typing — no separate adapter |
| `src/lib/canvas/editor-session/workspace.svelte.ts` | `#hydrate` now calls `documentFromLayerSource(tabSnap)` instead of `singleLayerDocument(...)`, so refresh reconstructs the full layer stack (not a flattened composite). `openDocument(SavedDocumentSummary)` intentionally stays on `singleLayerDocument(...)` because summaries carry only the composite thumbnail (out-of-scope follow-up) |
| `src/lib/canvas/workspace-snapshot-fixtures.ts` | New shared test fixture (`tabSnapshotFixture` + `FIXTURE_VIEWPORT` + `TabSnapshotFixtureOpts`). Default = smallest usable shape (1×1, zero buffer); callers wrap with `width: 16, height: 16` defaults as needed. Replaces 3 triplicated inline `makeTab` definitions across persistence + auto-save + workspace tests |
| `src/lib/canvas/document-hydration.test.ts` | Renamed all `documentFromSchemaV3` references to `documentFromLayerSource` |
| `src/lib/session/session-persistence.test.ts` | New slice 9 multi-layer round-trip test (every layer field — id/name/pixels/visibility/opacity — plus document-level state); new slice 10 end-to-end test ("Workspace with multiple layers survives save → restore → new Workspace") wires the real `Workspace` + `tab.addLayer()` through the actual save/restore pipeline. Inline `makeTab` collapsed to a wrapper over `tabSnapshotFixture`; `makeTabWithPixels` removed (callers migrated to `makeTab({ pixels })`) |
| `src/lib/session/auto-save.test.ts` | Inline `makeTab` collapsed to a wrapper over the shared fixture |
| `src/lib/canvas/editor-session/workspace.svelte.test.ts` | Inline `DEFAULT_VIEWPORT` + `makeTabSnap` removed in favor of the shared fixture (re-imported under the local alias `makeTabSnap`) |

### Key Decisions
- **Summary thumbnail = JS-composite, not a layer buffer**: `SavedDocumentSummary` keeps a single `pixels: Uint8Array` derived from `compositeV3(width, height, layers)`. The alternative (loading every layer for browsing) would balloon `getAllSavedDocuments` payload size for the saved-work browser without a real benefit — users browsing thumbnails don't need per-layer pixels. Issue 103's `## What to build` explicitly listed this as a choose-during-implementation decision.
- **`compositeV3` lives in TS (not Rust)**: The save/summary path needs a composite at points where there is no `Document` instance — only a serialized `LayerRecord[]`. Routing through Rust would require either rebuilding a transient `Document` per summary or exposing a separate `Document::from_layers + composite` round trip. A pure JS source-over implementation is simpler at this boundary and matches the renderer's algorithm (verified by a unit test that exercises straight source-over with per-layer opacity).
- **Structural-typed hydration helper**: `documentFromLayerSource(source)` accepts any value carrying the `DocumentLayerSource` shape (`width / height / layers / activeLayerId / nextLayerNumber / timelinePanelCollapsed`). Both `DocumentSchemaV3` and `TabSnapshot` satisfy it structurally, so the same helper serves first-load hydration (from IndexedDB) and runtime restore (from snapshot), without a separate adapter or duplicated builder code. Type narrows the parameter to read-only (`readonly LayerRecord[]`) so the helper can't accidentally mutate the source.
- **Test fixture consolidation**: `tabSnapshotFixture` centralizes the new multi-layer shape in one place. Three test files previously declared inline `makeTab`/`makeTabSnap` helpers that drifted in subtle ways (default sizes, layer ids, viewport defaults). Single source = single update site when the `TabSnapshot` shape evolves.

### Notes
- **`openDocument(SavedDocumentSummary)` still flattens to single-layer.** The saved-work browser's "open" path loads a `SavedDocumentSummary` (composite thumbnail only) and hydrates via `singleLayerDocument(...)`. Restoring the full layer stack from the saved-work browser would require loading the full `DocumentSchemaV3` record (not the summary) at open time — a deliberate follow-up that is out of 103's scope and not blocked by it.
- **Parent PRD 086 already marks `status: done` despite open siblings (095–100).** This pre-existing state was not modified per the `/task-done` skill rule: parent updates are gated on "all sibling sub-issues now have `status: done`," which is not yet true.
- **No history-semantics change.** `HistoryManager.push_document` remains in-memory; 103 only ensures the on-disk document survives refresh, not that history does.
- **All 891 Vitest cases pass; `svelte-check` reports 0 errors.**
