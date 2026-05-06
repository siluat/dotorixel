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

Scope:

- In `src/lib/canvas/editor-session/tab-state.svelte.ts`, replace `pixelCanvas: PixelCanvas` with `document: Document`.
- `samplingSession`, `toolRunner`, and `tabViewport` operate via the Document's active layer.
- The renderer uses `Document.composite()` as its source of pixels.
- Persistence is wired:
  - On load, V2 records run through `migrateV2ToV3` (089/090) and become V3 Documents in memory.
  - On save, V3 records are written.
- History uses the Document snapshot path from 088.
- `documentId` (the existing per-tab identifier on workspace records) is preserved.
- Existing E2E flows keep passing without modification.

## Acceptance criteria

- `TabState.document: Document` replaces `pixelCanvas`.
- Drawing with the Pencil tool applies pixels to the active layer (single layer at this point).
- Undo/redo operate on Document snapshots.
- An existing V2 IndexedDB record loads, migrates to V3, and renders with no pixel loss.
- Save/reload of a V3 Document round-trips with no pixel loss.
- Sampling sessions (canvas + reference) keep working.
- Existing Playwright E2E suite passes with no test changes.

## Blocked by

- [090 — TS V3 schema + migration](090-layer-system-ts-v3-schema-migration.md)

## Scenarios addressed

- Scenarios 1, 2, 6, 8, 9, 12.
