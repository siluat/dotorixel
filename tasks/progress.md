# Progress

## Currently Working On

Onion skinning — adjacent-frame ghosts while editing ([PRD](../issues/217-onion-skinning.md)): 2/3 sub-issues done — 218 (design spec) and 219 (state) shipped. Remaining: **[220 rendering + toggle](../issues/220-onion-skin-render-ui.md), now unblocked** (PR for 219 pending merge).

## Last Completed

[219 — Onion skin state — neighbor selection, ghost projection, persisted per-tab flag](../issues/219-onion-skin-state.md): the pure neighbor seam (clamped, never wrapping), the per-tab `showOnionSkin` flag persisting like the grid toggle (stored records without the field read as off — no schema bump), and the cached ghost projection sourcing `composite_at` — empty during Playback, computing touches no History/dirty/Active Frame. Landed dead-code-tolerant; 220 consumes it.

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
