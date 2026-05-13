# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD-086](../issues/086-layer-system-basic-infrastructure.md)). 13 done, 5 remaining (096/097/098/099/100). Per-row affordance pattern (`stopPropagation`, last-layer-style idempotency at the `TabState` boundary) is now established; 097's visibility chevron will follow the same rule. Web-only / Apple-preserved split recorded in ADR `docs/decisions/web-document-layer-apple-preserved.en.md`.

## Last Completed

[095 — Delete-layer button](../issues/095-layer-system-delete-layer-button.md): per-row `✕` removes the layer; disabled at single-layer and a parallel last-layer guard in `TabState.removeLayer` keeps the UI's disabled contract honest from non-UI call paths and protects history from orphan snapshots. Internal verb is `remove` everywhere (094 pattern), user-facing copy stays "Delete/삭제/削除" (UX idiom).

## Next Up

- [096 — Layer reorder](../issues/096-layer-system-reorder-layer.md)
  - Unblocked. 094 locked the panel-order convention; drag translates visual→stack via `stack_idx = (count - 1) - visual_idx`.
- [097 — Visibility toggle](../issues/097-layer-system-visibility-toggle.md)
  - Unblocked. Per-row visibility chevron + composite update. Must `stopPropagation` (see 104/095).
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
