# Progress

## Currently Working On

None.

## Last Completed

[181 — Rename single-canvas history to PixelCanvasHistory and delete the fused machinery](../issues/181-pixelcanvas-history-rename.md): the core's single-canvas undo/redo is now its own `PixelCanvasHistory` species over the shared ring, and the fused `HistoryManager` (mix-path enum + runtime panics) is gone — mixing the two history species is a compile error, not a runtime guard. The History split (180 → 181) is complete. Out-of-scope follow-up: Apple's `EditorState` undo/redo pixel-restore round-trip still has no Swift test (this rename left that pre-existing gap unchanged).

## Next Up

- Consolidate Floating Selection orchestration out of TabState — [182](../issues/182-consolidate-floating-selection-orchestration.md)
- Remove dead canvas-mode DrawingOps residue — [183](../issues/183-remove-dead-canvas-mode-drawingops.md) (unblocks 185)
- Extract `importReferenceFile` as a pure function — [184](../issues/184-extract-import-reference-file.md)
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
