# Progress

## Currently Working On

Selection tool — Marquee with move/copy/paste and per-tool clipping ([PRD](../issues/131-selection-tool-rectangle-select-move-nudge-copy-paste.md))

10 of 21 sub-issues are done; drag-time precision aids are now shipped. Core Floating Selection and clipboard paths remain the next Selection work.

## Last Completed

[141 — Drag-time visual aids — dimension tooltip + crosshair guides](../issues/141-drag-time-visual-aids.md): DefineMarquee now shows live dimensions and crosshair guides for mouse, pen, and touch; pointer-down-only clicks and LiftAndDrag do not show the aids.

## Next Up

- Touch modifier alternatives (unblocks Selection sub-issues 151 + 152)
- [142 — Drag-to-move (LiftAndDrag + commit + Undo)](../issues/142-selection-drag-to-move.md)
- [143 — Selection Clipboard + Copy + persistence](../issues/143-selection-clipboard-and-copy.md)
- Copy/paste
- Flip/transform
- Project file format (JSON-based) + save/load
- Apple Pencil: hover preview + palm rejection
- Feature guide page (basic usage instructions)
- (review) In-editor feedback widget
- Frame management (add/delete/duplicate/reorder)
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
