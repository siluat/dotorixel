---
title: "Layer system: TabState switch — `pixelCanvas` → `document`"
status: done
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

## Implementation notes

- **`documentFromSchemaV3` error path**: when adding a corrupt-schema policy, wrap only the `add_layer` loop in `try / catch`; call `builder.free()` inside `catch` and re-throw. Do **not** wrap `builder.build()` — it consumes `self` and `wasm-bindgen`'s `__destroy_into_raw()` zeroes `__wbg_ptr` before the WASM call, so a `finally`-style `builder.free()` would invoke `free(null)` (allocator-dependent). Pattern proposed by @greptile-apps on PR #191.

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

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `Document` becomes the source of truth: `document = $state<Document>(null!)`, populated from injected `deps.document` or built via `singleLayerDocument(...)` for fresh tabs. `pixelCanvas` retained as a render cache derived from the active layer. `samplingSession` reads from `self.document`; `toolRunner` host exposes `document`. `resize()` calls `resizeDocumentWithAnchor(this.document, ...)`. `exportPng()` and `toSnapshot()` read pixels via `this.document.composite()`. Single `documentReplaced` effect path replaces undo/redo dimension swaps |
| `src/lib/canvas/editor-session/workspace.svelte.ts` | `CreateTabConfig` accepts `document?: Document`. `openDocument()` and `#hydrate()` build the Document first via `singleLayerDocument(width, height, pixels)`; the tab derives its `pixelCanvas` from that |
| `src/lib/canvas/wasm-backend.ts` | New helpers consumed by the shell: `singleLayerDocument(w,h,px)`, `clearDocumentActiveLayer(doc)`, `resizeDocumentWithAnchor(doc,w,h,anchor)`, `createDocumentDrawingOps(getDocument)`, and `teeDrawingOps(primary, secondary)`. `resolveWasmDocument(doc)` guards the `WasmDocument`-only contract |
| `src/lib/canvas/stroke-engine.ts` | Tool draws now route through `teeDrawingOps(canvasOps, documentOps)`, so each pixel mutation lands on both `PixelCanvas` (render cache) and the Document active layer (truth) |
| `src/lib/canvas/tool-runner.svelte.ts` | `RunnerEffect` collapsed to a single `documentReplaced` variant. Undo/redo with dimension change emit it carrying a fresh `Document` rebuilt from the prior canvas snapshot via `singleLayerDocument(...)` |
| `crates/core/src/document.rs`, `wasm/src/lib.rs` | Adds `Document::get_pixel(x,y)` reading from the active layer + `WasmDocument::get_pixel` binding so the Document-backed `DrawingOps` can satisfy the `getPixel` contract without going through the canvas |
| `src/lib/canvas/canvas-model.ts` | `Document` interface gains the `get_pixel` member to mirror the WASM facade |
| `src/lib/canvas/editor-session/{tab-state,workspace}.svelte.test.ts`, `tool-runner.svelte.test.ts`, `stroke-engine.test.ts`, `session.test.ts` | One RED → GREEN test per slice; `session.test.ts`'s `setPixel` helper switched to drive `tab.drawStart/draw/drawEnd` so persistence tests exercise the tee path |

### Key Decisions

- **Strangler-pattern, 10 vertical slices**. Shadow `document` field on `TabState` advanced one consumer at a time (renderer → tools → sampling → history → resize → exportPng → toSnapshot → fromSnapshot → load path → final shadow removal). Each slice = one RED → GREEN cycle. No horizontal "all tests first, then all code."
- **Tee-write `DrawingOps` over a discriminated effect**. Tool draws mutate `PixelCanvas` (render cache) and the Document active layer in the same call via `teeDrawingOps`. This kept `canvasChanged` semantics intact while migrating the source of truth, so per-stroke history/sampling slices were no-ops at the shell layer.
- **`documentReplaced` is the only `RunnerEffect`**. The transitional `canvasReplaced` variant + `#rebuildShadowDocument()` were dead-code-removed in a follow-up cleanup once all consumers had moved.
- **`TabStateDeps.pixelCanvas?` removed**. Makes the contract impossible to misuse — Document is the only injected source. `@ts-expect-error` regression test asserts a passed `pixelCanvas` option is no longer accepted.

### Notes

- Persistence remains on V2 schema in IndexedDB; V2 → V3 migration runs at hydration boundary by piping snapshot pixels through `singleLayerDocument(...)`. Switching the on-disk format to V3 is a future task — this issue's acceptance criterion ("V2 record loads, migrates to V3, and renders with no pixel loss") is met because the in-memory side now uses Document.
- `bun run test`: 869/869 passing. `bun run check`: 0 errors / 0 warnings.
- Parent PRD 086 stays open; remaining sub-issues are 092–100 (TimelinePanel design, shell, add/delete/reorder buttons, visibility, mobile tab, collapsible).
