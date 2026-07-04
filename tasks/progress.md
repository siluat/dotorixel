# Progress

## Currently Working On

GIF/spritesheet export — multi-frame export formats ([PRD](../issues/213-gif-spritesheet-export.md)). 2/3 sub-issues done ([214 prefactor](../issues/214-export-format-source-prefactor.md), [215 spritesheet](../issues/215-spritesheet-export.md)); [216 GIF](../issues/216-gif-export.md) is the last one.

## Last Completed

[215 — Spritesheet (PNG) export](../issues/215-spritesheet-export.md): the first document-source format — every frame's composite tiled as one horizontal-strip PNG, end-to-end (core encoder → WASM → registry/UI, en/ja/ko). Caveat for future UI tests: happy-dom can't drive Svelte 5 select bindings (`:checked` unsupported) — selection flows belong in e2e.

## Next Up

- [216 — Animated GIF export](../issues/216-gif-export.md) (last remaining 213 sub-issue)
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
