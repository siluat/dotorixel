# Progress

## Currently Working On

Onion skinning — adjacent-frame ghosts while editing ([PRD](../issues/217-onion-skinning.md)). PRD published and broken into 3 sub-issues (0/3 done): [218 design (.pen)](../issues/218-onion-skin-design.md) (HITL) and [219 state](../issues/219-onion-skin-state.md) (AFK) are both unblocked and can run in parallel; [220 rendering + toggle](../issues/220-onion-skin-render-ui.md) rides both.

## Last Completed

[216 — Animated GIF export](../issues/216-gif-export.md): the second document-source format, closing the [213 GIF/spritesheet export PRD](../issues/213-gif-spritesheet-export.md) (all three sub-issues done). The encoder contract — axis-order frames, centisecond timing, infinite loop, alpha-128 binary transparency, exact palettes with quantization fallback, no ghosting — is pinned by decode round-trip tests; no new i18n strings (GIF stays an untranslated acronym like PNG/SVG).

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
