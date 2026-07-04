# Progress

## Currently Working On

None

## Last Completed

[216 — Animated GIF export](../issues/216-gif-export.md): the second document-source format, closing the [213 GIF/spritesheet export PRD](../issues/213-gif-spritesheet-export.md) (all three sub-issues done). The encoder contract — axis-order frames, centisecond timing, infinite loop, alpha-128 binary transparency, exact palettes with quantization fallback, no ghosting — is pinned by decode round-trip tests; no new i18n strings (GIF stays an untranslated acronym like PNG/SVG).

## Next Up

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
