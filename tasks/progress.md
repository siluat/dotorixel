# Progress

## Currently Working On

Per-frame speed control — per-frame duration (M4) ([PRD](../issues/193-per-frame-speed-control.md)). PRD + 5 sub-issues published (194–198, `ready-for-agent`). Next: start an unblocked slice — **194 (design, HITL)** and **195 (core, AFK)** have no blockers and run in parallel; 196 → 197 → 198 chain after.

## Last Completed

[192 — Frame operations UI](../issues/192-frame-operations-ui.md): the header frame-action group (add / duplicate / delete) + ruler-cell drag-reorder shipped, completing **PRD 186 — Frame management (M4 entry)**; the whole M4 animation cluster (per-frame speed, timeline UI, onion skinning, preview, GIF export) is now unblocked. Multi-frame state now flows through the workspace snapshot, so frames + per-cel pixels survive a page refresh — this closed the snapshot seam 190 had deferred. Follow-up: the frame/row icon buttons are still 24px on mobile (TimelinePanel touch-targets backlog item).

## Next Up

- Timeline UI (M4 — transport/playback strip; the ruler already reserves its slot)
- Onion skinning (M4 — needs per-arbitrary-frame composite)
- Animation preview — play/pause in editor (M4)
- GIF / spritesheet export (M4 — multi-frame export)
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
