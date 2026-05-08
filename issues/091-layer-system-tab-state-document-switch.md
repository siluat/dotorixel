---
title: "Layer system: TabState switch — `pixelCanvas` → `document`"
status: ready-for-agent
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Switch the web shell from the single `PixelCanvas` model to the `Document` model. This is the slice where the data-model replacement actually takes effect. Because every existing user is migrated to a Document with one layer, **there is no user-visible visual change** — drawing, undo, save/reload, sampling, and tool flow all keep working.

This is **pure shell-side wiring** — Rust core, WASM facade, and TS facade are
already complete. 101 (`Document builder + tool bindings + TS facade`) covers
the FFI plumbing this issue consumes.

Scope:

- In `src/lib/canvas/editor-session/tab-state.svelte.ts`, replace `pixelCanvas: PixelCanvas` with `document: Document` (the TS facade from 101).
- `samplingSession`, `toolRunner`, and `tabViewport` operate via the Document's active layer.
- The renderer uses `Document.composite()` as its source of pixels.
- Persistence is wired:
  - On load, V2 records run through `migrateV2ToV3` (090) and become V3 Documents in memory via `documentFromSchemaV3` (101).
  - On save, V3 records are written.
- History uses the TS `HistoryManager` document path (101) which wraps the WASM document-snapshot methods (088/089).
- `documentId` (the existing per-tab identifier on workspace records) is preserved.
- Existing E2E flows keep passing without modification.

### TDD strategy

This issue touches ~10 production files. To stay disciplined, work it as a
strangler-style migration via a shadow Document field on `TabState`, advancing
one consumer at a time (renderer → tools → sampling → history → resize →
exportPng → toSnapshot → fromSnapshot → load path → final removal of the
shadow). Each slice is one RED → GREEN cycle; do not write the full set of
new tests up front.

## Acceptance criteria

- `TabState.document: Document` replaces `pixelCanvas`.
- Drawing with the Pencil tool applies pixels to the active layer (single layer at this point).
- Undo/redo operate on Document snapshots.
- An existing V2 IndexedDB record loads, migrates to V3, and renders with no pixel loss.
- Save/reload of a V3 Document round-trips with no pixel loss.
- Sampling sessions (canvas + reference) keep working.
- Existing Playwright E2E suite passes with no test changes.

## Blocked by

- [101 — Document builder + tool bindings + TS facade](101-layer-system-document-builder-and-tool-bindings.md)
- [090 — TS V3 schema + migration](090-layer-system-ts-v3-schema-migration.md)

## Scenarios addressed

- Scenarios 1, 2, 6, 8, 9, 12.
