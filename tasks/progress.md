# Progress

## Currently Working On

None

## Last Completed

[221 — Collapse EditorController into an Input Pipeline module](../issues/221-collapse-editor-controller-into-input-pipeline.md): the 80-member facade is deleted — templates bind `workspace.shared` / `workspace.activeTab` directly, and a 16-member Input Pipeline owns the only real input policies. Intended behavior change: the shortcut-hints admission gate now also blocks canvas sampling. Net ≈ −600 lines; 222–224 remain independent and unblocked.

## Next Up

- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
- [222 — Consolidate source-over compositing into one core primitive](../issues/222-consolidate-source-over-compositing.md)
- [223 — Say the schema-migration chain once](../issues/223-single-expression-schema-migration-chain.md)
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
