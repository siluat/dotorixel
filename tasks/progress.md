# Progress

## Currently Working On

None

## Last Completed

[198 — TimelinePanel control + i18n + E2E](../issues/198-frame-duration-timeline-ui.md): the active-frame duration editor (text input, ms + derived fps) now lives in the timeline's ruler corner — commit-on-Enter/blur, undoable, persisted, with an E2E tracer. This **completes PRD 193** (per-frame duration: authored, editable, durable, undoable end-to-end on Web). Playback/preview and GIF export are the separate M4 consumers of this timing data.

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
