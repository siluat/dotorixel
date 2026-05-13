# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD-086](../issues/086-layer-system-basic-infrastructure.md)). 14 done, 4 remaining (097/098/099/100). Desktop add/delete/reorder all landed; 097's visibility chevron is the natural next slice and inherits the established per-row pattern (`stopPropagation` + last-layer-style idempotency at the `TabState` boundary).

## Last Completed

[096 — Layer reorder](../issues/096-layer-system-reorder-layer.md): per-row `≡` handle supports drag-and-drop or ArrowUp/Down reordering. The visual↔stack mapping (`stack_idx = (count - 1) - visual_idx`) is encapsulated in `TabState.reorderLayer` and locked by a unit test, so future panel-order changes will fail loudly instead of silently inverting depth.

## Next Up

- [097 — Visibility toggle](../issues/097-layer-system-visibility-toggle.md)
  - Unblocked. Per-row visibility chevron + composite update. Must `stopPropagation` (see 104/095/096).
- [098 — Mobile Timeline tab](../issues/098-layer-system-mobile-timeline-tab.md)
  - Unblocked. Mobile entry point — independent of desktop add/delete/reorder.
- [099 — Collapsible chevron (no persistence)](../issues/099-layer-system-collapsible-toggle.md)
  - Unblocked. Header chevron toggles in-memory collapsed state.
- [100 — Persist `timelinePanelCollapsed`](../issues/100-layer-system-collapsible-persistence.md)
  - Depends on 099 landing first (need the in-memory flag to persist).
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Independent. Next Apple Phase 1 item.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but on hold — shape tools not yet on Apple side.
