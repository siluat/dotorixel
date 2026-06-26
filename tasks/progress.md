# Progress

## Currently Working On

In-editor animation playback — transport strip + preview ([PRD](../issues/199-animation-playback-transport.md)): 3/4 sub-issues done — 200 (transport design) + 201 (`composite_at` seam) + 202 (playback engine) shipped. Remaining: **203 (transport strip UI + i18n + E2E, now unblocked)** — it wires the 202 engine to a UI.

## Last Completed

[202 — Shell playback controller](../issues/202-playback-controller.md): the headless playback engine — a per-tab transient Playhead + rAF clock that advances frames by each `duration_ms` and previews committed art through `composite_at`, never mutating the Document (no dirty, no history, Active Frame unmoved). Lands without UI (203 wires the transport); reusable `fake-frame-scheduler` test double added.

## Next Up

- Onion skinning (M4 — multi-frame; `composite_at` seam now available)
- GIF / spritesheet export (M4 — multi-frame export; `composite_at` seam now available)
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
