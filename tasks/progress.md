# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD-086](../issues/086-layer-system-basic-infrastructure.md)). 17 done, 1 remaining (100). 099 landed the in-memory collapse behavior; the last open slice is persisting that flag through the Document/V3 schema.

## Last Completed

[099 — Collapsible chevron (no persistence)](../issues/099-layer-system-collapsible-toggle.md): desktop chevron in the TimelinePanel header toggles between expanded (h=180) and collapsed (h=32). State is component-local `$state` — by design, since lifting it to Document is sub-issue 100's scope. Page refresh resets to expanded.

## Next Up

- [100 — Persist `timelinePanelCollapsed`](../issues/100-layer-system-collapsible-persistence.md)
  - Unblocked. Lift the in-memory flag onto Document + V3 schema so refresh preserves it.
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Independent. Next Apple Phase 1 item.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but on hold — shape tools not yet on Apple side.
