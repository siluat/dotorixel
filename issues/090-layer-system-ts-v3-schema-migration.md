---
title: "Layer system: TS V3 persistence schema + V2→V3 migration (not yet wired)"
status: done
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Define the V3 persistence schema for a Document, and write the V2→V3 migration function. The migration is **not yet invoked** — TabState still uses the V2 single-canvas path. Main is unaffected.

Scope:

- Add `DocumentSchemaV3` in `src/lib/session/session-storage-types.ts`.
  - Top-level fields: dimensions, layers, activeLayerId, nextLayerNumber, **timelinePanelCollapsed**.
  - Per-layer fields: id (UUID v4), name, pixels (compatible with the existing single-canvas pixel encoding), visible, opacity.
- Implement the migration function: V2 single pixel buffer → V3 Document with one wrapped layer, `name = "Layer 1"`, `nextLayerNumber = 2`, dimensions preserved, `timelinePanelCollapsed = false`.
- History is dropped during migration — V2 history is in single-canvas shape and is incompatible with the Document shape. Migrated sessions start with empty history.
- The `viewports` field on workspace records and other persistence shapes are untouched.
- Vitest unit tests cover migration only — invocation will be added in 091.

## Acceptance criteria

- `DocumentSchemaV3` is defined with the fields above.
- Migration function `migrateV2ToV3` accepts a V2 record and returns a V3 record with no pixel loss.
- Dimensions are preserved.
- Resulting V3 has exactly one layer, `name === "Layer 1"`, `nextLayerNumber === 2`, `timelinePanelCollapsed === false`.
- History is empty (or absent) on the V3 record.
- No call site in the app yet invokes the migration; existing IndexedDB load/save behavior is unchanged on main.
- Vitest suite for migration passes.

## Blocked by

- [089 — WASM Document facade](089-layer-system-wasm-document-facade.md)

## Scenarios addressed

- Partial coverage of Scenario 9 (migration logic; not yet wired).

## Results

| File | Description |
|------|-------------|
| `src/lib/session/session-storage-types.ts` | Added `LayerRecord` (id/name/pixels/visible/opacity) and `DocumentSchemaV3` (schemaVersion: 3, dimensions, layers, activeLayerId, nextLayerNumber, timelinePanelCollapsed, saved, timestamps); added `migrateV2ToV3` pure function. |
| `src/lib/session/session-storage.test.ts` | 5 new Vitest cases under `describe('migrateV2ToV3')` covering tracer (single-layer wrap, schemaVersion=3, pixel preservation), dimensions+counters (nextLayerNumber=2, timelinePanelCollapsed=false), activeLayerId=layer.id with UUID v4 format, default visibility/opacity (true/1), and top-level metadata pass-through (id, name, saved, createdAt, updatedAt). |

### Key Decisions

- **`LayerRecord` is unversioned.** Other persistence record types in the file (`WorkspaceRecord`, `ViewportRecord`, `ReferenceImageRecord`, `DisplayStateRecord`) are all unversioned; only the top-level `DocumentSchemaV*` carries a version. Adding `LayerRecordV3` would be premature versioning ("don't design for hypothetical future requirements") — if a future schema needs a different layer shape, version then.
- **`StoredDocument` and `DocumentRecord` aliases left at `V1 | V2` / `V2`.** Per the issue, "no call site in the app yet invokes the migration; existing IndexedDB load/save behavior is unchanged on main." Updating the union would force schema-3 awareness on every storage call site. 091 will widen the union when wiring `TabState`.
- **History dropped without persistence-side changes.** V1/V2 `DocumentSchema` had no `history` field — V2 history lives in the in-memory `HistoryManager`, not in IndexedDB. The acceptance criterion "history is empty (or absent) on the V3 record" is satisfied structurally because V3 also defines no `history` field. No runtime guard needed.
- **UUID generation via `crypto.randomUUID()`.** Available in happy-dom (test env) and all browser targets; matches the WASM facade contract that accepts UUID v4 strings at the boundary (089).

### Notes

- TDD vertical-slicing deviation, self-reported: GREEN #1 implemented the full V3 schema and migration in one step rather than expanding minimally per RED. Tests #2–#5 passed without an intervening RED. Behavior is correct, but the implementation was driven by the spec rather than by failing tests. Future TDD cycles should keep the GREEN step narrower.
- Slice remains dead code on `main`: nothing constructs a `DocumentSchemaV3` or calls `migrateV2ToV3` outside the test suite. 091 is the first consumer.
