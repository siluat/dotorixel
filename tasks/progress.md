# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD-086](../issues/086-layer-system-basic-infrastructure.md)). 15 sub-issues (087–101) + late-added 102/103; 11 done, 6 remaining (095/096/097/098/099/100). End-to-end persistence is wired (102 composite-driven render + 103 V3 multi-layer persistence), so remaining UI sub-issues are visually verifiable through both refresh and saved-work paths. Web-only / Apple-preserved split recorded in ADR `docs/decisions/web-document-layer-apple-preserved.en.md`.

## Last Completed

[103 — V3 multi-layer pixel persistence wiring](../issues/103-layer-system-multi-layer-persistence.md): IndexedDB bumped to V3 with V1/V2→V3 migration; `TabSnapshot` serializes the full layer stack; `Workspace.#hydrate` rebuilds via `WasmDocumentBuilder`. Saved-work browser keeps a single composite-thumbnail buffer per summary so browsing stays cheap. Out of scope: re-hydrating full layer stack from saved-work-browser open path (still flattens to single-layer — follow-up).

## Next Up

- [095 — Delete-layer button](../issues/095-layer-system-delete-layer-button.md)
  - Unblocked. `addLayer` pattern from 094 transfers directly.
- [096 — Layer reorder](../issues/096-layer-system-reorder-layer.md)
  - Unblocked. 094 locked the panel-order convention; drag translates visual→stack via `stack_idx = (count - 1) - visual_idx`.
- [097 — Visibility toggle](../issues/097-layer-system-visibility-toggle.md)
  - Unblocked. Per-row visibility chevron + composite update.
- [098 — Mobile Timeline tab](../issues/098-layer-system-mobile-timeline-tab.md)
  - Unblocked. Mobile entry point — independent of desktop add/delete/reorder.
- [099 — Collapsible chevron (no persistence)](../issues/099-layer-system-collapsible-toggle.md)
  - Unblocked. Header chevron toggles in-memory collapsed state.
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Independent. Next Apple Phase 1 item.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but on hold — shape tools not yet on Apple side.
