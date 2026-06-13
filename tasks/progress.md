# Progress

## Currently Working On

Flip & rotate transforms ([PRD](../issues/176-flip-and-rotate-transforms.md)).
1 of 3 transform sub-issues is done; region rotation is now unblocked, while whole-document rotation still waits on the region-rotation slice.

## Last Completed

[177 — Flip horizontal & vertical — region and active layer](../issues/177-flip-horizontal-vertical.md): Flip H/V are now undoable from both Web entry points, target either the active Marquee or active Pixel Layer, and no-op cleanly on Reference Layers. Rotation remains out of scope for follow-up slices.

## Next Up

- Copy/paste
- Rotate region 90° CW & CCW
- Project file format (JSON-based) + save/load
- Apple Pencil: hover preview + palm rejection
- Feature guide page (basic usage instructions)
- (review) In-editor feedback widget
- Frame management (add/delete/duplicate/reorder)
- Feedback link to Google Form
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
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
