# Progress

## Currently Working On

None

## Last Completed

[164 — Seal the Sampling Session view and name its species](../issues/164-seal-sampling-session-view.md): Canvas and Reference sampling now share a named Loupe-facing view contract while keeping separate lifecycle ownership. Behavior stayed unchanged; typecheck, unit, build, and E2E all pass.

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
