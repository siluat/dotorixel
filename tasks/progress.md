# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD](../issues/086-layer-system-basic-infrastructure.md)). PRD decomposed into 15 sub-issues (087–101); 087 + 088 + 089 + 090 + 091 + 092 + 093 + 094 + 101 done, 6 remaining from the original decomposition. ADR `docs/decisions/web-document-layer-apple-preserved.en.md` records the web-only / Apple-preserved split. With **094** (＋ add-layer button) landed, the panel now mutates the WASM document in place — page-level `activeLayerId` and `layers` deriveds subscribe via `tab.renderVersion`, and the panel iterates the stack in reverse so the top row is z-top (Aseprite/Photoshop convention; the convention is locked in 094's acceptance criteria so 095/096/097 inherit it). Sub-issues **102** (composite render path) and **103** (V3 multi-layer pixel persistence wiring) added 2026-05-11 to close two implementation gaps surfaced during 094 review: the main canvas still renders only the active-layer mirror (`tab-state.pixelCanvas`), so additional layers exist in the document but never appear on screen; and `DocumentSchemaV3` is declared in `session-storage-types.ts` but `SessionStorage` and `tab-state.toSnapshot()` are still on V2, so every refresh collapses multi-layer documents back to one layer. PRD-086 body updated with explicit wiring scope under "Persistence" and "TabState integration", plus a "Follow-up sub-issues (post-decomposition gaps)" section. 102 and 103 are prioritized ahead of 095–100.

## Last Completed

[094 — Add-layer button](../issues/094-layer-system-add-layer-button.md): TimelinePanel header gains a 24×24 `+` button (`data-add-layer`, Paraglide-driven `aria-label`); clicking calls `tab.addLayer(name)` which pushes a snapshot, runs `document.add_layer(crypto.randomUUID(), name)`, bumps `renderVersion`, and marks the doc dirty. Default layer name is localized via new Paraglide messages (`layer_default_name`, `layer_panel_title`, `aria_addLayer` in en/ko/ja); name formatting happens at the call site so `tab-state` stays free of i18n. `+page.svelte`'s `activeLayerId` and `layers` deriveds now read `tab.renderVersion` (Document is a WASM handle and doesn't trigger reactivity on its own); `layers` iterates `count-1 → 0` so panel top = z-top. `Document` structural interface in `canvas-model.ts` extended with `add_layer(new_id, name)` for the compile-time `expectTypeOf` check. Six TabState Vitest cases (count delta, active swap, name pass-through, monotonic counter, undo, render/dirty signals), two TimelinePanel cases (button render, click forwards to `onAddLayer`), three Playwright e2e cases (top-row insertion, monotonic 4→1 panel order, undo+redo). Companion edits: 094 issue locks the panel-order convention as acceptance, and 096 issue notes the visual→stack index translation (`stack_idx = (count - 1) - visual_idx`).

## Next Up

- [102 — Switch main canvas render to `document.composite()`](../issues/102-layer-system-composite-render-path.md)
  - **Priority** — closes the render-path gap surfaced after 094: the renderer still reads `tab-state.pixelCanvas` (active-layer mirror), so anything below or on a non-active layer is invisible. 095/096/097 cannot be visually verified without this.
- [103 — V3 multi-layer pixel persistence wiring](../issues/103-layer-system-multi-layer-persistence.md)
  - **Priority** — closes the persistence gap: `DocumentSchemaV3` and `migrateV2ToV3` are declared but `SessionStorage`/`tab-state.toSnapshot()` are still on V2, so every refresh flattens multi-layer documents and discards per-layer metadata. Required before any M3 release that exposes the layer system.
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
