# Progress

## Currently Working On

None

## Last Completed

[223 — Say the schema-migration chain once](../issues/223-single-expression-schema-migration-chain.md): the V1→V7 schema-upgrade order is now expressed exactly once and reused by both the read path and the IndexedDB upgrade handler (now DDL plus a single normalize pass). Intended behaviour change locked in — skip-on-error is uniform: a corrupt record at any version is skipped with a warning instead of failing the DB open. 224 remains independent and unblocked.

## Next Up

- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
- [224 — One authority for active-layer editability](../issues/224-single-authority-active-layer-editability.md)
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
