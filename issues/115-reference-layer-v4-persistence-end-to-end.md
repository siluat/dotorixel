---
title: "Reference Layer: V4 persistence end-to-end (Reference Layer round-trip)"
status: done
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Wire the V4 schema and the V3→V4 migration end-to-end so that documents with Reference Layers round-trip through reload. IndexedDB `DB_VERSION` bumps to V4 with a V3→V4 cursor migration; the hydrate path reads `ReferenceLayerRecord`, re-decodes the source blob via `decode-reference-blob.ts`, and reconstructs the in-memory Document with both Pixel and Reference layers.

Scope:

- IndexedDB: bump `DB_VERSION` to V4 with a V3→V4 cursor migration that runs `migrateV3ToV4` (from 114) against every stored document.
- Hydrate: when loading a document, distinguish `kind: 'pixel'` vs `kind: 'reference'` per layer. Pixel layers use the existing pixel-encoding path. Reference layers re-decode the source blob via `src/lib/reference-images/decode-reference-blob.ts` to produce the source RGBA buffer; `naturalWidth` / `naturalHeight` / `placement` are passed straight through to the WASM `add_reference_layer` (or an equivalent restore path).
- Dehydrate: when saving, write each layer per its `kind`. Reference layers store the source blob (not the decoded RGBA buffer).
- Round-trip test: create a document with a Reference Layer (auto-fit placement); dehydrate; hydrate; the restored document has the same layers in the same order with identical placements, identical natural dimensions, and identical source bytes.
- Legacy V3 docs continue to open (migration path verified end-to-end).

## Acceptance criteria

- IndexedDB DB_VERSION is 4.
- Stored V3 documents auto-migrate to V4 on first open (no manual step).
- Reference Layer source blob is persisted (not the decoded RGBA buffer) and re-decoded on hydrate via `decode-reference-blob.ts`.
- `naturalWidth`, `naturalHeight`, `placement` round-trip identically through reload.
- A document with one Pixel + one Reference Layer survives reload with both layers in the original order and both layers' kind preserved.
- Existing single-Pixel-only documents are unaffected by the upgrade.

## Blocked by

- [114 — TS V4 schema + V3→V4 migration](114-reference-layer-v4-schema-and-migration.md)

## User stories addressed

- #17, #22.

## Results

| File | Description |
|------|-------------|
| `src/lib/session/session-storage-types.ts` | Added V4 document records and Pixel-only saved-work thumbnail compositing. |
| `src/lib/session/session-storage.ts` | Bumped IndexedDB to V4 and normalized legacy V1/V2/V3 records through the V4 migration path. |
| `src/lib/session/session-persistence.ts` | Serialized mixed Pixel/Reference layers, persisted Reference source blobs, and re-decoded them on restore. |
| `src/lib/canvas/workspace-snapshot.ts` | Extended workspace snapshots to carry Reference Layer records alongside Pixel layers. |
| `src/lib/canvas/wasm-backend.ts` | Hydrated mixed-layer documents by routing Pixel and Reference layer sources through the appropriate document builder path. |
| `wasm/src/lib.rs` | Added a Reference Layer restore entry point that preserves source size, placement, visibility, and opacity. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Preserved Reference source blobs as a session sidecar so snapshots remain possible after undo restores a removed layer. |
| `src/lib/canvas/editor-session/workspace.svelte.ts` | Reattached hydrated Reference source blobs when restoring workspace tabs. |
| `src/lib/session/*.test.ts`, `src/lib/canvas/*.test.ts` | Covered V3→V4 migration, Reference round-trip restore, mixed-layer hydration, thumbnail exclusion, and undo/snapshot regression cases. |

### Key Decisions

- Reference Layers persist the original `sourceBlob` and re-decode it during hydrate instead of storing decoded RGBA buffers.
- Reference source blobs remain in the tab sidecar after layer removal so undo history can restore the layer and still produce a valid persistence snapshot.
- Saved-work thumbnails use the export-only Pixel composite so Reference Layers stay excluded from thumbnail output.

### Notes

- User-facing Reference Layer import is still owned by 118; this slice proves the storage/session/hydration path with mixed-layer fixtures.
- Timeline kind affordances remain in 117, so the parent PRD remains open.

### Amendment (2026-05-22)

PRD-105 was corrected: Reference Layer is singleton and fixed bottom-most. Persistence remains required, but round-trip expectations should be updated before 118 proceeds:

- documents must hydrate with at most one Reference Layer;
- saving should not write multiple Reference records;
- loading legacy or malformed V4 data with multiple Reference records should normalize or reject according to the chosen boundary policy;
- restored Timeline order should keep Reference below all Pixel Layers;
- thumbnail exclusion remains correct.
