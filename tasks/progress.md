# Progress

## Currently Working On

Tiered transforms — split flip/rotate into Canvas Transform and Marquee Transform tiers ([PRD](../issues/207-tiered-canvas-marquee-transforms.md)). 2 of 4 sub-issues done (208 canvas flip, 209 canvas rotate — the panels are now fully on Canvas Transform ops); 206 (reference exclusion) and 210 (marquee ops) are both unblocked, 206 is next per the PRD order.

## Last Completed

[209 — Canvas Rotate: explicit whole-document op with Marquee co-transform](../issues/209-canvas-rotate-explicit-op.md): the panels' Rotate buttons now always turn the whole Document — dimensions swap, every Cel, an active Marquee carried through the quarter-turn and clipped, one undo step — with no Marquee-presence dispatch. The Reference Layer still turns with the canvas, pinned by a test that 206 starts by flipping; SelectionActionBar rotate untouched (210's job).

## Next Up

- Onion skinning (M4 — multi-frame; `composite_at` seam available)
- GIF / spritesheet export (M4 — multi-frame export; `composite_at` seam available)
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
- Apple Pencil: hover preview + palm rejection
- Feedback link to Google Form
- (review) In-editor feedback widget
- Selection UI stuck while a Reference Layer is active — hide the selection UI when the active layer is a Reference Layer ([issue 205](../issues/205-selection-ui-reference-layer-active.md), ready-for-agent)
- Reference image window polish — opacity slider, lock toggle, flip H/V, rotate
- Reference image import — clipboard paste support
- Design: share artwork dialog — URL sharing dialog UI (.pen)
- FG/BG swap UI improvements
- Dark mode toggle UI
- Document error conditions on `PixelCanvas` public API
- IndexedDB quota exceeded error handling
- Document rename
- Canvas resize via border drag
- Timelapse recording
- TimelinePanel mobile touch targets — frame + row icon buttons ≥44px on the mobile Timeline tab
