# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD](../issues/086-layer-system-basic-infrastructure.md)). PRD decomposed into 15 sub-issues (087–101) plus the late-added 102 and 103; 087 + 088 + 089 + 090 + 091 + 092 + 093 + 094 + 101 + 102 + 103 done, 6 remaining (095/096/097/098/099/100). ADR `docs/decisions/web-document-layer-apple-preserved.en.md` records the web-only / Apple-preserved split. With **103** (V3 multi-layer pixel persistence wiring) landed, the document is now durable end-to-end: `SessionStorage` is on `DB_VERSION = 3`, `tab-state.toSnapshot()` serializes every layer (`id / name / pixels / visible / opacity`) + document-level state (`activeLayerId / nextLayerNumber / timelinePanelCollapsed`), `Workspace.#hydrate` calls `documentFromLayerSource(...)` to reconstruct the full layer stack via `WasmDocumentBuilder`, and V2 records auto-upgrade to V3 on open (one Layer 1, no pixel loss). The saved-work browser keeps a single composite-thumbnail buffer per summary via the new JS `compositeV3(...)`, so browsing stays cheap. The remaining sub-issues (delete / reorder / visibility / mobile timeline / collapsible chevron / chevron persistence) are now visually verifiable through both refresh and saved-work open paths.

## Last Completed

[103 — V3 multi-layer pixel persistence wiring](../issues/103-layer-system-multi-layer-persistence.md): IndexedDB schema bumped to V3 with a cursor-driven `V1/V2 → V3` migration on `onupgradeneeded`. `StoredDocument` union extended to `V1 | V2 | V3`; `DocumentRecord` repointed to `DocumentSchemaV3`. New pure JS `compositeV3(width, height, layers)` (straight source-over, multiplies layer opacity into source alpha, skips invisible) shared by the save path and the saved-work-browser summary path so `SavedDocumentSummary.pixels` keeps its single-buffer thumbnail shape without loading every layer for browsing. `TabSnapshot` migrated from flat `pixels: Uint8Array` to `layers: readonly LayerRecord[]` + `activeLayerId` + `nextLayerNumber` + `timelinePanelCollapsed`; `tab-state.toSnapshot()` now emits the multi-layer shape via `document.layer_id_at/name_at/pixels_at/visible_at/opacity_at` plus document-level accessors. New `documentFromLayerSource(source)` hydration helper in `wasm-backend.ts` accepts any `DocumentLayerSource` (structurally satisfied by both `DocumentSchemaV3` and `TabSnapshot`) and assembles a multi-layer `Document` via `WasmDocumentBuilder` — `Workspace.#hydrate` switched off `singleLayerDocument(...)`. `SessionPersistence.save/restore` round-trip the full V3 record. New shared test fixture `workspace-snapshot-fixtures.ts` consolidates `tabSnapshotFixture` for persistence + auto-save + workspace tests; 3 previously-triplicated `makeTab/makeTabSnap` helpers collapsed into one source. New slice-9 multi-layer round-trip test (every layer field + document state) and slice-10 end-to-end test (real `Workspace` + `addLayer()` → save → restore → new Workspace) live in `session-persistence.test.ts`. All 891 Vitest cases pass; `svelte-check` reports 0 errors. `openDocument(SavedDocumentSummary)` intentionally still flattens to single-layer via `singleLayerDocument(...)` because summaries carry only the composite thumbnail — restoring the full stack from the saved-work browser is a follow-up out of 103's scope.

## Next Up

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
