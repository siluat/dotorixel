# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD](../issues/086-layer-system-basic-infrastructure.md)). PRD decomposed into 15 sub-issues (087–101); 087 + 088 + 089 + 090 + 091 + 092 + 101 done, 8 remaining (see `todo.md`). ADR `docs/decisions/web-document-layer-apple-preserved.en.md` records the web-only / Apple-preserved split. With **091** (TabState switch) landed, the web shell now treats `Document` as the single source of truth. With **092** (TimelinePanel design) landed, the visual spec for desktop expanded/collapsed and mobile (canvas + h=146 panel split via the existing LAYERS tab) is finalized in `docs/pencil-dotorixel.pen` for downstream UI sub-issues to implement against. **093** (TimelinePanel shell) is now fully unblocked.

## Last Completed

[092 — TimelinePanel design (Candidate A detail pass)](../issues/092-layer-system-timeline-panel-design.md): finalized the pixel-level design for the layer × frame timeline panel in `docs/pencil-dotorixel.pen`. 8-section spec: §1 Anatomy (layer-row callouts), §2 Active state matrix (default/hover/active/active+hover), §3 Desktop Light (expanded h=180 + collapsed h=32), §4 Desktop Dark, §5 Mobile Light (canvas + h=146 panel split entered via existing LAYERS tab), §6 Mobile Dark, §7 Frame axis evolution (M3 dim placeholder → M4 frame ruler grows in place), §8 Design notes. Key decisions: layer-row layout `[👁 visibility] [name (fill)] [✕ delete] [≡ reorder]` (Aseprite/Photoshop convention); active row = surface fill tone + 2px accent bar (two channels for color-blind safety); panel header h=32 with "Layers" + add (＋) on left, chevron on right (reserves M4 frame-ruler region); sidebar 256px / row 32px desktop; mobile uses split layout with the canonical `mStatusBar` (h=54) + `mAppBar` (h=44) + `Tab Bar Pill` (h=62 in padding [8,16,20,16]) chrome cloned unchanged from the existing `A9dne` / `wbAke` references — timelinePanel is the only new UI; M3 frame axis = single dim/static column placeholder (not hidden) to keep panel structure stable across the M3 → M4 evolution; existing tokens only, no new tokens. Mid-pass rebuild was required after audit feedback flagged that the first-pass mobile chrome had been redesigned by mistake; orphan clones polluting canonical reference frames were cleaned up and the chrome was re-cloned with correct argument order.

## Next Up

- [093 — TimelinePanel shell (desktop, single-layer row)](../issues/093-layer-system-timeline-panel-shell.md)
  - Now unblocked (092 design output landed). Implements the visual spec from §3/§4 of the 092 design block.
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Independent. Now that the docked layout is in, this is the next Apple Phase 1 item.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but blocked on shape tools not yet existing on Apple side; functionally on hold.
