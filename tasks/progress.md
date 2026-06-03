# Progress

## Currently Working On

Selection tool — Marquee with move/copy/paste and per-tool clipping ([PRD](../issues/131-selection-tool-rectangle-select-move-nudge-copy-paste.md))

12 of 21 sub-issues are done; Selection Clipboard now captures read-only Cmd/Ctrl+C Marquee snapshots and survives reload/tab switching. Cancel, nudge, cut/paste, action bar, and Shift follow-ups remain.

## Last Completed

[143 — Selection Clipboard + Copy (Cmd+C) + workspace persistence](../issues/143-selection-clipboard-and-copy.md): Cmd/Ctrl+C now copies the active Marquee into a workspace-shared clipboard without mutating pixels, and that clipboard persists across reload/tab switching. Paste remains follow-up work.

## Next Up

- Touch modifier alternatives (unblocks Selection sub-issues 151 + 152)
- [144 — Escape cancels Floating Selection mid-drag](../issues/144-escape-cancels-floating-selection.md)
- [145 — Arrow nudge + Shift 10× multiplier](../issues/145-arrow-nudge-and-shift-multiplier.md)
- [146 — Cut (Cmd+X)](../issues/146-cut-cmd-x.md)
- [147 — Clear Canvas / Delete Layer × Floating commits-first](../issues/147-clear-canvas-delete-layer-floating-commit.md)
- [148 — Paste (Cmd+V)](../issues/148-paste-cmd-v.md)
- [149 — Action Bar Idle implementation](../issues/149-selection-action-bar-idle-implementation.md)
- [150 — Action Bar Floating state](../issues/150-selection-action-bar-floating-state.md)
- Copy/paste
- Flip/transform
- Project file format (JSON-based) + save/load
- (review) Evaluate serde-wasm-bindgen + tsify for WASM↔TS serialization
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
- (review) Public roadmap & feature voting system
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
