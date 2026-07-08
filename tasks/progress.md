# Progress

## Currently Working On

None

## Last Completed

[224 — One authority for active-layer editability](../issues/224-single-authority-active-layer-editability.md): the Reference-Layer editability rule (no paint/Marquee) now has one authority — a single projection predicate enforced only at TabState — so the stroke engine and Selection tool trust the precondition instead of re-checking layer kind. Also seals the mid-stroke hazard: a live stroke's target layer/frame can no longer switch or vanish under it. Full mutating-surface uniformization is deferred to the future prepare-to-mutate-gate work.

## Next Up

- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
- Apple Pencil: hover preview + palm rejection
- Feedback link to Google Form
- (review) In-editor feedback widget
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
