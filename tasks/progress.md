# Progress

## Currently Working On

None

## Last Completed

[203 — Transport strip UI + playhead + i18n + E2E](../issues/203-transport-strip-ui.md): wired the transport strip (single Play/Pause + Loop + `n / N` readout) and the ▼ playhead marker to the 202 engine on both docked + mobile — **completing PRD 199 (in-editor animation playback)**. Playback stays preview-only: no history entry, no dirty mark, the Active Frame never moves. `composite_at` now has a live consumer, ready for onion skin / export next.

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
