# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD-086](../issues/086-layer-system-basic-infrastructure.md)). 16 done, 2 remaining (099/100). With 098 landed, the layer interface is now reachable on both desktop (RightPanel) and mobile (LAYERS tab); what's left is the panel collapse behavior and its persistence.

## Last Completed

[098 — Mobile Timeline tab](../issues/098-layer-system-mobile-timeline-tab.md): added the LAYERS tab (3rd of 4) to mobile BottomTabs, surfacing the same TimelinePanel without hiding the canvas. Reorder was reworked from HTML5 Drag & Drop to PointerEvents so the handle works on touch as well as mouse — same code path for both inputs. `MobileTab` union extracted to a single module to prevent re-sync drift across consumers.

## Next Up

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
