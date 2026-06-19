# Progress

## Currently Working On

Frame management (add/delete/duplicate/reorder) — M4 entry ([PRD](../issues/186-frame-management.md)). Core foundation [188](../issues/188-frame-cel-grid-core.md) shipped (1/5 slices). Now unblocked and runnable in parallel: [189 — Frame WASM binding + Change Journal intents](../issues/189-frame-wasm-journal-intents.md) and [190 — Document schema V6](../issues/190-document-schema-v6-frames.md); then 191 (ruler shell) → 192 (operations UI).

## Last Completed

[188 — Frame cel-grid + frame operations (Rust core)](../issues/188-frame-cel-grid-core.md): `Document` gained a non-empty frame axis with one Cel (a `PixelCanvas`) per Pixel Layer per frame (the grid invariant); Reference Layers stay frame-independent. Dead-code-tolerant and single-frame-preserving — the initial frame uses `Frame::INITIAL` (nil UUID) and there is no shell consumer yet (real caller-supplied frame ids + the WASM binding land in 189).

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
