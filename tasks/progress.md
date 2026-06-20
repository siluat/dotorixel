# Progress

## Currently Working On

Frame management (add/delete/duplicate/reorder) — M4 entry ([PRD](../issues/186-frame-management.md)). Core/WASM/persistence (188–190) and ruler shell + selection [191](../issues/191-frame-ruler-shell.md) shipped — 4/5 slices. Next runnable: [192 — frame operations UI](../issues/192-frame-operations-ui.md) (unblocked by 191).

## Last Completed

[191 — Frame ruler shell + selection (TimelinePanel)](../issues/191-frame-ruler-shell.md): TimelinePanel grew into the Layer × Frame grid — ruler ordinals, cel-occupancy dots, Reference spanning bar, 2-channel active highlight, frame/cel selection — built to the 187 design spec. Cel occupancy is web-side behind a `cel_is_empty` seam; multi-frame persistence and the frame-operation UI land with 192.

## Next Up

- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
- Apple Pencil: hover preview + palm rejection
- (review) In-editor feedback widget
- Feedback link to Google Form
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
- TimelinePanel mobile touch targets — header/row icon buttons ≥44px on the mobile Timeline tab
