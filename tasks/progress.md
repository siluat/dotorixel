# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD-086](../issues/086-layer-system-basic-infrastructure.md)). 15 sub-issues (087–101) + late-added 102/103/104; 12 done, 6 remaining (095/096/097/098/099/100). User-driven layer activation is now wired, so 095/097 can build their nested per-row buttons against a working row-click handler. Web-only / Apple-preserved split recorded in ADR `docs/decisions/web-document-layer-apple-preserved.en.md`.

## Last Completed

[104 — Activate layer on row click](../issues/104-layer-system-activate-layer-on-row-click.md): row click (or Space / Enter) sets the active layer; the idempotency contract (no-op when clicking the already-active row) lives in `TabState.setActiveLayer`, not the component. Selection is not in history — matches Photoshop / Aseprite. Sub-issues 095 / 097 must `stopPropagation` on nested per-row buttons.

## Next Up

- [095 — Delete-layer button](../issues/095-layer-system-delete-layer-button.md)
  - Unblocked. `addLayer` pattern from 094 transfers directly. Per-row delete button must `stopPropagation` so it doesn't trigger row activation (104).
- [096 — Layer reorder](../issues/096-layer-system-reorder-layer.md)
  - Unblocked. 094 locked the panel-order convention; drag translates visual→stack via `stack_idx = (count - 1) - visual_idx`.
- [097 — Visibility toggle](../issues/097-layer-system-visibility-toggle.md)
  - Unblocked. Per-row visibility chevron + composite update. Must `stopPropagation` (see 104).
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
