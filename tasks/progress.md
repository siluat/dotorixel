# Progress

## Currently Working On

None

## Last Completed

[210 — Marquee Transform: explicit region ops, drop the Marquee-presence dispatch](../issues/210-marquee-transform-explicit-ops.md): the SelectionActionBar's flip/rotate are now explicit marquee ops (`flip_marquee_*`/`rotate_marquee_*`) — a no-op without a Marquee or on a Reference Layer, pushing no History entry and never marking dirty. This closes [PRD 207](../issues/207-tiered-canvas-marquee-transforms.md): no transform operation changes scope based on Marquee presence anymore.

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
