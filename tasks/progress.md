# Progress

## Currently Working On

In-editor animation playback — transport strip + preview ([PRD](../issues/199-animation-playback-transport.md)): 1/4 sub-issues done — 200 (transport strip design) shipped. Remaining: **201 (per-frame `composite_at` seam, unblocked)** → 202 (playback controller, needs 201) → 203 (transport UI, needs 202).

## Last Completed

[200 — Animation playback transport strip design (.pen)](../issues/200-animation-playback-transport-design.md): the 199 spec — a full-width fixed transport bar (Play/Pause toggle · Loop · n/N readout) with a sweeping ▾ playhead kept visually distinct from the static Active-Frame highlight; light/dark + mobile ≥44px. Placement picked via a 3-variant study; no global fps (per-frame ms remains the source of truth). Implementation lands in 201–203.

## Next Up

- Onion skinning (M4 — needs per-arbitrary-frame composite; reuses `composite_at` from PRD 199)
- GIF / spritesheet export (M4 — multi-frame export; reuses `composite_at` from PRD 199)
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
