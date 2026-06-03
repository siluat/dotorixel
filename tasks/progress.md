# Progress

## Currently Working On

Selection tool — Marquee with move/copy/paste and per-tool clipping ([PRD](../issues/131-selection-tool-rectangle-select-move-nudge-copy-paste.md))

20 of 21 sub-issues are done. Physical-keyboard Shift now constrains DefineMarquee to a square; the remaining Selection sub-issue is Floating Selection axis lock.

## Last Completed

[151 — Shift = square constraint during DefineMarquee](../issues/151-shift-square-define.md): Physical-keyboard Shift constrains Marquee definition to a square, including canvas-edge and outside-in drags. Touch modifier parity remains in the project-wide Touch modifier alternatives task.

## Next Up

- Selection sub-issue 152 — Shift = axis lock during Floating drag
- Touch modifier alternatives (touch Shift/Alt modifier parity)
- Copy/paste
- Flip/transform
- Project file format (JSON-based) + save/load
- Apple Pencil: hover preview + palm rejection
- Feature guide page (basic usage instructions)
- (review) In-editor feedback widget
- Frame management (add/delete/duplicate/reorder)
- Per-frame speed control
- Timeline UI
- Onion skinning
- Animation preview (play/pause in editor)
- GIF/spritesheet export
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
