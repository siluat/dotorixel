# Progress

## Currently Working On

None

## Last Completed

[222 — Consolidate source-over compositing into one core primitive](../issues/222-consolidate-source-over-compositing.md): one source-over primitive now backs every Rust blend, and the Floating Selection preview renders through a single core patch-composite call instead of a per-layer read-back plus a TS re-blend. Bit-identical (existing suites unchanged); the WASM-free thumbnail path is pinned to the core composite by a new ≤1-per-channel parity test. 223/224 remain independent and unblocked.

## Next Up

- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
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
