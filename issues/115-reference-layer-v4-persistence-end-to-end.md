---
title: "Reference Layer: V4 persistence end-to-end (Reference Layer round-trip)"
status: needs-triage
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
