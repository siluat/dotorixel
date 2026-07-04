# Progress

## Currently Working On

Tiered transforms — split flip/rotate into Canvas Transform and Marquee Transform tiers ([PRD](../issues/207-tiered-canvas-marquee-transforms.md)). 3 of 4 sub-issues done (208 canvas flip, 209 canvas rotate, 206 reference exclusion); 210 (Marquee Transform explicit ops) is the last remaining slice and is unblocked.

## Last Completed

[206 — Whole-canvas transforms leave the Reference Layer fixed](../issues/206-reference-fixed-under-canvas-transforms.md): canvas rotate no longer remaps the reference placement, matching flip — the Reference Layer is now excluded from every Canvas Transform. Already-saved rotated references still render and sample (the rotation machinery stays); nothing produces new reference rotations anymore.

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
- Enforce rustfmt in pre-commit and fix the 3 existing violations
