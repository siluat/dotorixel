# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD](../issues/086-layer-system-basic-infrastructure.md)). PRD decomposed into 15 sub-issues (087–101); 087 + 088 + 089 + 090 + 091 + 092 + 093 + 094 + 101 + 102 done, 5 remaining from the original decomposition plus 103. ADR `docs/decisions/web-document-layer-apple-preserved.en.md` records the web-only / Apple-preserved split. With **102** (composite render path) landed, the renderer now reads `document.composite()` end-to-end — `pixelCanvas` mirror removed from `TabState` / `SessionHost` / `ToolRunnerHost` / `ToolContext`, tools write only through `createDocumentDrawingOps`, and the new `RenderableCanvas` interface is satisfied by both `PixelCanvas` (export path) and `TabState.compositeBuffer` (render path). Multi-layer documents now display all visible layers source-over blended; the previous "only active layer shows" symptom is fixed. **103** (V3 multi-layer pixel persistence wiring) remains the next priority — without it, refresh still collapses multi-layer documents back to one layer because `tab-state.toSnapshot()` and `SessionStorage` are still on V2.

## Last Completed

[102 — Switch main canvas render to `document.composite()`](../issues/102-layer-system-composite-render-path.md): The main canvas renderer now consumes `document.composite()` (every visible layer blended source-over) instead of the active-layer mirror. `pixelCanvas` field removed from `TabState`; new `compositeBuffer` getter returns `{width, height, pixels: () => document.composite()}`. `RenderableCanvas` interface formalized in `renderer.ts` (the minimal `{width, height, pixels()}` shape) and `PixelCanvasView`'s prop typed against it. Tool writes route only through `createDocumentDrawingOps` — `teeDrawingOps` composition with `createDrawingOps(pixelCanvas)` removed from `stroke-engine`. `SessionHost.pixelCanvas` / `ToolRunnerHost.pixelCanvas` / `ToolContext.canvas` fields all removed, so the type system blocks any regression that would re-introduce the mirror. New WASM helper trio for active-layer pixel I/O: `activeLayerPixels(doc)` (read), `restoreActiveLayerPixels(doc, pixels)` (write — Rust `Document::restore_active_layer_pixels` + WASM binding added), `clearActiveLayerPixels(doc)` (rename from `clearDocumentActiveLayer`). All three pivot on the `ActiveLayerPixels` naming axis for read/clear/restore symmetry. `shapeTool` and `moveTool` snapshot-restore previews use the new helpers in place of `pixelCanvas.pixels()` / `restore_pixels`. Export path keeps a `PixelCanvas` via `TabState.exportableSnapshot()` built fresh from `document.composite()` for `encode_png` / `encode_svg`. `+page.svelte` UI labels (TopBar/StatusBar/RightPanel/ExportBottomSheet) read `editor.document.width/height`; export confirmation captures one snapshot and reuses it for filename + export + analytics. New `createFakeDocument` stub in `fake-drawing-ops` keeps tool-authoring tests free of WASM. All 883 Vitest cases pass; 8/8 Pixel Perfect e2e tests pass against the composite path; `svelte-check` reports 0 errors. Persistence (V2 schema) intentionally untouched — owned by 103.

## Next Up

- [103 — V3 multi-layer pixel persistence wiring](../issues/103-layer-system-multi-layer-persistence.md)
  - **Priority** — closes the persistence gap: `DocumentSchemaV3` and `migrateV2ToV3` are declared but `SessionStorage`/`tab-state.toSnapshot()` are still on V2, so every refresh flattens multi-layer documents and discards per-layer metadata. With 102 done, this is the last gap before 095–100 are fully end-to-end verifiable. Required before any M3 release that exposes the layer system.
- [095 — Delete-layer button](../issues/095-layer-system-delete-layer-button.md)
  - Unblocked. Next slice in the PRD-086 add/delete/reorder triad; pattern of `addLayer` from 094 transfers directly. Visual verification depends on 102.
- [096 — Layer reorder](../issues/096-layer-system-reorder-layer.md)
  - Unblocked. 094 locked the panel-order convention; 096 already has a note that drag must translate visual→stack via `stack_idx = (count - 1) - visual_idx`. Visual verification depends on 102.
- [097 — Visibility toggle](../issues/097-layer-system-visibility-toggle.md)
  - Unblocked. Independent of 095/096; touches per-row visibility chevron + composite update. Visual verification depends on 102.
- [098 — Mobile Timeline tab](../issues/098-layer-system-mobile-timeline-tab.md)
  - Unblocked. Mobile entry point — independent of desktop add/delete/reorder.
- [099 — Collapsible chevron (no persistence)](../issues/099-layer-system-collapsible-toggle.md)
  - Unblocked. Header chevron toggles the panel's collapsed state in memory.
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Independent. Now that the docked layout is in, this is the next Apple Phase 1 item.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but blocked on shape tools not yet existing on Apple side; functionally on hold.
