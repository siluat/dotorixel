# Progress

## Currently Working On

None.

## Last Completed

[182 — Consolidate Floating Selection orchestration out of TabState](../issues/182-consolidate-floating-selection-orchestration.md): `TabState` now drives the Floating Selection feature through the lifecycle interface — a single `#mutate` commit-before-mutation boundary (the `isDrawing` guard lives inside `commitIfPending`) plus `marqueeForSnapshot` owning the persisted-Marquee baseline; the scattered 13× commit calls and the `#selectionPreviewBaselineMarquee` field are gone. Web-only, no behavior change. Out-of-scope follow-up: paste/duplicate still have no e2e (clipboard-permission flakiness); `copyMarqueeRegion` in the baseline capture is currently redundant but kept for consistency.

## Next Up

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
