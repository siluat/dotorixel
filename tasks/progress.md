# Progress

## Currently Working On

None.

## Last Completed

[183 — Remove dead canvas-mode DrawingOps residue](../issues/183-remove-dead-canvas-mode-drawingops.md): the web↔core drawing seam now exposes exactly one live drawing path (the Document-backed factory), with the dead pre-Document canvas path deleted and that factory promoted to the sole `createDrawingOps`. Web-only, no behavior change — verified by type-check, vitest, and full e2e. Unblocks 185 (dissolve the `CanvasBackend` umbrella).

## Next Up

- Extract `importReferenceFile` as a pure function — [184](../issues/184-extract-import-reference-file.md)
- Dissolve the `CanvasBackend` umbrella; editor-session imports wasm adapters directly — [185](../issues/185-dissolve-canvas-backend-umbrella.md)
- Frame management (add/delete/duplicate/reorder) — M4 entry; the rest of the animation cluster depends on it
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
