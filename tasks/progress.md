# Progress

## Currently Working On

None.

## Last Completed

[180 — Carve out Document History over a shared generic history ring](../issues/180-document-history-shared-ring.md): the web shell's undo/redo now runs on a dedicated Document History species over a private generic ring that owns the branch-discard/evict invariant, and the WASM binding dropped its single-canvas surface. Mixing the two history species is now unrepresentable rather than runtime-guarded. The pre-split fused manager stays for Apple's single-canvas path; its duplicated document path is removed in the now-unblocked [181](../issues/181-pixelcanvas-history-rename.md).

## Next Up

- History split follow-up — `PixelCanvasHistory` onto the shared ring + remove the fused manager's dup document path — [181](../issues/181-pixelcanvas-history-rename.md)
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
