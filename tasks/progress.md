# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD](../issues/086-layer-system-basic-infrastructure.md)). PRD decomposed into 15 sub-issues (087–101); 087 + 088 + 089 + 090 + 091 + 101 done, 9 remaining (see `todo.md`). ADR `docs/decisions/web-document-layer-apple-preserved.en.md` records the web-only / Apple-preserved split. With **091** (TabState switch) landed, the web shell now treats `Document` as the single source of truth: tool draws tee-write into the active layer, `samplingSession` / `toolRunner` / `tabViewport` query the Document, undo/redo go through `push_document` / `undo_document` / `redo_document`, and persistence migrates V2 → V3 at the hydration boundary. **092** (TimelinePanel design, HITL) is independently startable; **093** (TimelinePanel shell) is now unblocked except for 092's design output.

## Last Completed

[091 — TabState switch: `pixelCanvas` → `document`](../issues/091-layer-system-tab-state-document-switch.md): completed the 10-slice strangler migration that moves `TabState`'s source of truth from `PixelCanvas` to `Document`. Slices: renderer → tools → sampling → history → resize → exportPng → toSnapshot → constructor accepts document → load path → shadow removal. Each slice = one RED → GREEN cycle. Key shape changes: `TabState.document = $state<Document>(null!)` populated from `deps.document` (or fresh via `singleLayerDocument(...)`); `pixelCanvas` survives only as a render cache derived from the active layer; `samplingSession.getSamplingPort` returns `self.document`; `toolRunner` host exposes `document`; `resize()` calls `resizeDocumentWithAnchor(this.document, ...)`; `exportPng()` and `toSnapshot()` read pixels via `this.document.composite()`. Tool draws route through new `teeDrawingOps(canvasOps, documentOps)` so each pixel mutation lands on both backings — kept `canvasChanged` semantics intact and made history/sampling slices no-ops at the shell layer. `RunnerEffect` collapsed to a single `documentReplaced` variant (transitional `canvasReplaced` + `#rebuildShadowDocument()` removed in follow-up). `TabStateDeps.pixelCanvas?` removed entirely — `@ts-expect-error` regression test prevents reintroduction. New helpers in `wasm-backend.ts`: `singleLayerDocument`, `clearDocumentActiveLayer`, `resizeDocumentWithAnchor`, `createDocumentDrawingOps`, `teeDrawingOps`. Rust `Document::get_pixel` + WASM binding added so the document-backed `DrawingOps` satisfies `getPixel` without going through canvas. Persistence stays on V2 schema in IndexedDB; V2 → V3 migration is in-memory only. `bun run test` 869/869 pass, `bun run check` 0 errors / 0 warnings.

## Next Up

- [092 — TimelinePanel design (Candidate A detail pass)](../issues/092-layer-system-timeline-panel-design.md)
  - Independent (no blockers); HITL `.pen` design task. Unblocks 093 (TimelinePanel shell).
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Independent. Now that the docked layout is in, this is the next Apple Phase 1 item.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but blocked on shape tools not yet existing on Apple side; functionally on hold.
