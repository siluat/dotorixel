# Progress

## Currently Working On

Tiered transforms — split flip/rotate into Canvas Transform and Marquee Transform tiers ([PRD](../issues/207-tiered-canvas-marquee-transforms.md)). 1 of 4 sub-issues done (208 canvas flip — tier patterns established); 209 (canvas rotate) is now unblocked and next; then 206 (reference exclusion) and 210 (marquee ops).

## Last Completed

[208 — Canvas Flip: whole-document flip with Marquee co-transform](../issues/208-canvas-flip-whole-document.md): the panels' Flip buttons now mirror every Pixel Layer's every Cel (Reference fixed, Marquee co-moved + clipped, one undo step) with no Marquee-presence dispatch. Established the PRD's naming chain (`flip_canvas_*` / `'flip-canvas-*'` / `flipCanvas*` / `action_transformFlipCanvas*`) that 209/210 follow; SelectionActionBar and rotate paths intentionally untouched.

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
