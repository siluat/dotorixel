# Progress

## Currently Working On

None

## Last Completed

[165 — Deepen the Reference Window Placement Interaction](../issues/165-deepen-reference-window-placement-interaction.md): The References module now owns the Reference Window move/resize gesture lifecycle end-to-end, and auto-save marks dirty once per completed gesture (a mid-drag flush can no longer persist unclamped positions). Follow-up to evaluate on touch hardware: only one window gesture is active at a time, so two-finger simultaneous window drags no longer move both.

## Next Up

- Touch modifier alternatives (touch Shift-constrain, Selection axis lock, Alt-eyedropper UI)
- Copy/paste
- Flip/transform
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
- Validate `ReferencePlacement.scale` invariant
- `cargo fmt` debt in `wasm/src/lib.rs`
- Collapse `sample_reference` free function into `ReferenceData::sample_at(x, y)`
