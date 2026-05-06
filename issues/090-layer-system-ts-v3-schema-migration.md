---
title: "Layer system: TS V3 persistence schema + V2→V3 migration (not yet wired)"
status: ready-for-agent
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
