# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD](../issues/086-layer-system-basic-infrastructure.md)). PRD decomposed into 15 sub-issues (087–101); 087 + 088 + 089 + 090 + 091 + 092 + 093 + 094 + 101 done, 6 remaining (see `todo.md`). ADR `docs/decisions/web-document-layer-apple-preserved.en.md` records the web-only / Apple-preserved split. With **094** (＋ add-layer button) landed, the panel now mutates the WASM document in place — page-level `activeLayerId` and `layers` deriveds subscribe via `tab.renderVersion`, and the panel iterates the stack in reverse so the top row is z-top (Aseprite/Photoshop convention; the convention is locked in 094's acceptance criteria so 095/096/097 inherit it). **Persistence gap surfaced**: layer additions still mutate only the in-memory Document — IndexedDB write path remains on V2 schema. No PRD-086 sub-issue currently owns multi-layer pixel persistence (100 only owns the `timelinePanelCollapsed` flag). A follow-up issue is needed before shipping M3.

## Last Completed

[094 — Add-layer button](../issues/094-layer-system-add-layer-button.md): TimelinePanel header gains a 24×24 `+` button (`data-add-layer`, Paraglide-driven `aria-label`); clicking calls `tab.addLayer(name)` which pushes a snapshot, runs `document.add_layer(crypto.randomUUID(), name)`, bumps `renderVersion`, and marks the doc dirty. Default layer name is localized via new Paraglide messages (`layer_default_name`, `layer_panel_title`, `aria_addLayer` in en/ko/ja); name formatting happens at the call site so `tab-state` stays free of i18n. `+page.svelte`'s `activeLayerId` and `layers` deriveds now read `tab.renderVersion` (Document is a WASM handle and doesn't trigger reactivity on its own); `layers` iterates `count-1 → 0` so panel top = z-top. `Document` structural interface in `canvas-model.ts` extended with `add_layer(new_id, name)` for the compile-time `expectTypeOf` check. Six TabState Vitest cases (count delta, active swap, name pass-through, monotonic counter, undo, render/dirty signals), two TimelinePanel cases (button render, click forwards to `onAddLayer`), three Playwright e2e cases (top-row insertion, monotonic 4→1 panel order, undo+redo). Companion edits: 094 issue locks the panel-order convention as acceptance, and 096 issue notes the visual→stack index translation (`stack_idx = (count - 1) - visual_idx`).

## Next Up

- [095 — Delete-layer button](../issues/095-layer-system-delete-layer-button.md)
  - Unblocked. Next slice in the PRD-086 add/delete/reorder triad; pattern of `addLayer` from 094 transfers directly.
- [096 — Layer reorder](../issues/096-layer-system-reorder-layer.md)
  - Unblocked. 094 locked the panel-order convention; 096 already has a note that drag must translate visual→stack via `stack_idx = (count - 1) - visual_idx`.
- [097 — Visibility toggle](../issues/097-layer-system-visibility-toggle.md)
  - Unblocked. Independent of 095/096; touches per-row visibility chevron + composite update.
- [098 — Mobile Timeline tab](../issues/098-layer-system-mobile-timeline-tab.md)
  - Unblocked. Mobile entry point — independent of desktop add/delete/reorder.
- [099 — Collapsible chevron (no persistence)](../issues/099-layer-system-collapsible-toggle.md)
  - Unblocked. Header chevron toggles the panel's collapsed state in memory.
- (gap) Multi-layer pixel persistence — V3 schema wiring not yet ticketed; create a follow-up issue under PRD 086 before shipping M3.
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Independent. Now that the docked layout is in, this is the next Apple Phase 1 item.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but blocked on shape tools not yet existing on Apple side; functionally on hold.
