# Progress

## Currently Working On

Frame management (add/delete/duplicate/reorder) — M4 entry ([PRD](../issues/186-frame-management.md)). Core frame/cel grid slice shipped ([188](../issues/188-frame-cel-grid-core.md)); 1 of 5 implementation slices is done. Next ready slices: [189](../issues/189-frame-wasm-journal-intents.md) and [190](../issues/190-document-schema-v6-frames.md) can start in parallel; 191/192 remain blocked.

## Last Completed

[188 — Frame cel-grid + frame operations (Rust core)](../issues/188-frame-cel-grid-core.md): the core now owns the Frame × Pixel Layer cel grid while preserving single-frame behavior. WASM/journal exposure and V6 persistence remain follow-up slices.

## Next Up

- [189 — Frame WASM binding + Change Journal intents](../issues/189-frame-wasm-journal-intents.md)
- [190 — Document schema V6 — frames + per-cel persistence](../issues/190-document-schema-v6-frames.md) — parallel with 189
- Per-frame speed control
- Timeline UI
- Onion skinning
- Animation preview (play/pause in editor)
- GIF/spritesheet export
- Feedback link to Google Form
- Apple Pencil: hover preview + palm rejection
- (review) In-editor feedback widget
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
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
