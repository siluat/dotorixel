# Progress

## Currently Working On

Frame management (add/delete/duplicate/reorder) — M4 entry ([PRD](../issues/186-frame-management.md)). Core [188](../issues/188-frame-cel-grid-core.md), WASM/journal [189](../issues/189-frame-wasm-journal-intents.md), and persistence V6 [190](../issues/190-document-schema-v6-frames.md) shipped (3/5 slices). Next runnable: [191 — frame ruler shell](../issues/191-frame-ruler-shell.md) (unblocked by 190) → [192 — operations UI](../issues/192-frame-operations-ui.md).

## Last Completed

[190 — Document schema V6 — frames + per-cel persistence](../issues/190-document-schema-v6-frames.md): bumped web persistence to V6 (`frames` + `activeFrameId`, per-cel `cels`) with a lossless V5→V6 migration. The snapshot has no frame axis yet, so live save/restore synthesizes/collapses a single frame — multi-frame capacity is proven at the record level only; the seam to flow real frames through the snapshot opens with the UI slice (191/192).

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
