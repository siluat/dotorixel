# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD-086](../issues/086-layer-system-basic-infrastructure.md)). 15 done, 3 remaining (098/099/100). The desktop sidebar is now feature-complete (add/delete/reorder/visibility); what's left is the mobile entry point and the panel collapse behavior.

## Last Completed

[097 — Visibility toggle](../issues/097-layer-system-visibility-toggle.md): per-row `◉`/`◎` toggle, hidden rows visually distinct (italic + dimmed), composite excludes hidden layers, undoable. The TabState boundary short-circuits no-op re-applies (no orphan snapshot) — same idempotency pattern as `setActiveLayer`. Touch target (24×24) and hidden-row visual spec remain open against `web-styling.md` ≥44px and the unfinished 092 design pass; both are panel-wide concerns, not regressions.

## Next Up

- [098 — Mobile Timeline tab](../issues/098-layer-system-mobile-timeline-tab.md)
  - Unblocked. Mobile entry point — independent of desktop add/delete/reorder/visibility.
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
