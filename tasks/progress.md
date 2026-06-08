# Progress

## Currently Working On

None

## Last Completed

[163 — Batch layer metadata across the WASM seam](../issues/163-batch-layer-metadata-wasm-seam.md): The Document seam now reads all of a layer's metadata in one batched call instead of ~8 per-field crossings, and the fine-grained accessors are gone (bulk pixel buffers stay on-demand). Behavior-preserving — full unit/e2e suites plus a real-browser smoke test (reference layers + draw-on-reference guard) all pass. Sourced from the architecture review (candidate #2); candidates #4 (concentrate undoable intents), #5 (Marquee math), #6 (reference-image lifecycle) remain open follow-ups.

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
