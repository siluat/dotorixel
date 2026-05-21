---
title: "Reference Layer: TS V4 schema + V3→V4 migration (not yet wired)"
status: done
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Define the V4 persistence schema for documents with mixed Pixel + Reference layers, and write the V3→V4 migration function. The migration is **not yet invoked** — TabState still uses the V3 path. Main is unaffected. **Deep-module test #4 — V3→V4 migration** lives here (testing decisions §1).

Scope:

- In `src/lib/session/session-storage-types.ts`:
  - `LayerRecord = PixelLayerRecord | ReferenceLayerRecord` discriminated union, keyed on `kind: 'pixel' | 'reference'`.
  - `PixelLayerRecord` is the existing layer-record shape with `kind: 'pixel'` added.
  - `ReferenceLayerRecord` stores: `kind: 'reference'`, `id`, `name`, `visible`, `opacity`, `sourceBlob` (preferred — keeps storage compact), `naturalWidth`, `naturalHeight`, `placement`.
  - `DocumentSchemaV4` containing the new layer union, `schemaVersion: 4`.
- `migrateV3ToV4(doc: DocumentSchemaV3) → DocumentSchemaV4`:
  - Every V3 layer becomes `{ kind: 'pixel', ...existing }` with no pixel loss.
  - `nextLayerNumber`, dimensions, `activeLayerId`, `timelinePanelCollapsed` preserved.
  - History dropped (legacy snapshots have no kind information — same precedent as V2→V3).
- Vitest unit tests covering migration only — invocation is in 115.
- No call site in the app yet invokes the migration; existing IndexedDB load/save behavior is unchanged on main.

## Acceptance criteria

- `DocumentSchemaV4` and the `LayerRecord` discriminated union are defined.
- `ReferenceLayerRecord` carries source blob, natural dimensions, and placement.
- `migrateV3ToV4()` wraps each V3 layer as `kind: 'pixel'` with no pixel loss.
- `nextLayerNumber`, dimensions, `activeLayerId`, `timelinePanelCollapsed` are preserved.
- History is empty (or absent) on the V4 record.
- Migration is idempotent on already-V4 input (defensive expectation pinned by test).
- Documents with no layers are not migrated (defensive — pinned by test).
- Vitest suite for migration passes.
- No call site outside the test suite invokes the migration.

## Blocked by

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)

## User stories addressed

- Foundation for #18.

## Results

| File | Description |
|------|-------------|
| `src/lib/session/session-storage-types.ts` | Added the V4 mixed-layer schema types and the V3→V4 migration helper. |
| `src/lib/session/session-storage-types.test.ts` | Added migration coverage for Pixel Layer wrapping, metadata preservation, idempotent V4 input, and empty-layer rejection. |
| `src/lib/canvas/workspace-snapshot.ts` | Kept runtime tab snapshots on the V3 Pixel-layer-only record type until V4 persistence is wired. |
| `src/lib/canvas/wasm-backend.ts` | Kept Document hydration on the V3 Pixel-layer-only record type until Reference Layer hydration lands. |

### Key Decisions

- `DocumentRecord` remains V3 for now because this slice defines the V4 schema but does not wire IndexedDB or TabState to it; issue 115 owns that integration.
- The existing V3 layer shape was renamed to `PixelLayerRecordV3`, leaving the new `LayerRecord` name for the V4 `kind: 'pixel' | 'reference'` union.

### Notes

- `migrateV3ToV4()` is intentionally unused outside tests in this slice.
- V3 documents with no layers are rejected defensively instead of silently producing an invalid V4 document.
