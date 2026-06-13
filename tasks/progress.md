# Progress

## Currently Working On

Flip & rotate transforms ([PRD](../issues/176-flip-and-rotate-transforms.md)) — 1 of 3 sub-issues done. 177 (flip H/V) shipped the shared transform pipeline; 178 (rotate region 90°) is now unblocked, 179 (whole-document rotate) still waits on 178.

## Last Completed

[177 — Flip horizontal & vertical](../issues/177-flip-horizontal-vertical.md): H/V flip across the full pipeline (Rust core → WASM → Change Journal → three UI entry points: SelectionActionBar, desktop RightPanel, compact Settings). Target (Marquee region vs whole active layer) is resolved in Rust at apply time via payload-less intents; Reference Layer is a no-op. Compact Transform parity was added beyond the issue's two named entry points.

## Next Up

- Copy/paste
- Rotate region 90° CW & CCW ([178](../issues/178-region-rotate-90.md)) — unblocked by 177
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
