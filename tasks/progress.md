# Progress

## Currently Working On

In-editor animation playback — transport strip + preview ([PRD](../issues/199-animation-playback-transport.md)): 2/4 sub-issues done — 200 (transport strip design) + 201 (`composite_at` seam) shipped. Remaining: **202 (playback controller, now unblocked)** → 203 (transport UI, needs 202).

## Last Completed

[201 — Per-frame composite seam (`composite_at`)](../issues/201-per-frame-composite-at.md): a per-arbitrary-frame composite in core + web binding, with `composite()` now its active-frame special case. Read-only (no journal), validated at the WASM boundary, lands dead-code-tolerant (no consumer yet). Unblocks 202; the same seam onion skinning + multi-frame export will reuse.

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
