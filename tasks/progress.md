# Progress

## Currently Working On

None.

## Last Completed

[185 — Dissolve the CanvasBackend umbrella](../issues/185-dissolve-canvas-backend-umbrella.md): the umbrella port is gone — editor-session layers (TabState/Workspace) and the session construction paths now import the wasm adapters directly. The seams that earn their keep are preserved (TabViewport still takes a `ViewportOps`; the change journal still takes an injected `createDocumentHistory` with a test fake). Behavior-preserving (unit + e2e green).

## Next Up

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
