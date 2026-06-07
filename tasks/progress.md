# Progress

## Currently Working On

None

## Last Completed

[162 — Seal the Loupe geometry contract](../issues/162-seal-loupe-geometry-contract.md): The Loupe's box geometry now has one source — the config drives the rendered box via CSS custom properties, so it can't desync from the `LOUPE_WIDTH`/`HEIGHT` the position math uses (a real-browser e2e measures the box against those totals). Notable: loupe padding/gap were deliberately moved off the shared `--ds-space-3` token (documented, value unchanged). Sourced from the architecture review (candidate #3); sibling candidate #2 (batch layer metadata) remains an open follow-up.

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
