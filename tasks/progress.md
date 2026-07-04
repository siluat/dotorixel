# Progress

## Currently Working On

GIF/spritesheet export — multi-frame export formats ([PRD](../issues/213-gif-spritesheet-export.md)). 1/3 sub-issues done: [214 prefactor](../issues/214-export-format-source-prefactor.md) landed, unblocking [215 spritesheet](../issues/215-spritesheet-export.md) and [216 GIF](../issues/216-gif-export.md) to proceed independently.

## Last Completed

[214 — Prefactor: export formats declare their source](../issues/214-export-format-source-prefactor.md): the web export format registry is now a still-source/document-source discriminated union and the shared confirm flow resolves the declared source lazily. PNG/SVG behavior unchanged (existing export e2e passed); no document-source format ships yet — 215/216 each add one.

## Next Up

- [215 — Spritesheet (PNG) export](../issues/215-spritesheet-export.md) (unblocked; parallel with 216)
- [216 — Animated GIF export](../issues/216-gif-export.md) (unblocked; parallel with 215)
- Onion skinning (M4 — multi-frame; `composite_at` seam available)
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
