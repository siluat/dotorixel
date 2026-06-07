# Progress

## Currently Working On

None

## Last Completed

[160 — Deepen Navigation Bounds into a single viewport owner](../issues/160-deepen-navigation-bounds-ownership.md): Every viewport mutation (pan, zoom, zoom-fit, resize) now clamps to one Navigation Bounds sink — canvas ∪ active-Reference footprint — so zoom/fit/resize respect the footprint like panning already did. Surfaced and fixed a dev-only infinite-effect-loop regression. Follow-up enabled: reference-geometry consolidation (architecture review candidate #4).

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
