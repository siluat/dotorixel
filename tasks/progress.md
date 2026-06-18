# Progress

## Currently Working On

Frame management (add/delete/duplicate/reorder) — M4 entry ([PRD](../issues/186-frame-management.md)). Design slice ([187](../issues/187-frame-ruler-design.md)) shipped — the Layer × Frame grid is finalized. Implementation slices broken out ([188](../issues/188-frame-cel-grid-core.md)–[192](../issues/192-frame-operations-ui.md)). Next: start [188 — Frame cel-grid + frame operations (Rust core)](../issues/188-frame-cel-grid-core.md) (the only unblocked slice; 189/190 follow, 191 then 192).

## Last Completed

[187 — Frame ruler design (.pen)](../issues/187-frame-ruler-design.md): the M4 Layer × Frame grid is finalized (cel = layer×frame; Pixel/Reference distinction via a continuous spanning bar; symmetric Layers/Frames labels; canonical mobile chrome reused). The `.pen` lives in the `dotorixel-codex` worktree — commit it there. Header metric (bare icons) intentionally diverges from the impl's 24×24 buttons — flagged for a design↔impl sync.

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
