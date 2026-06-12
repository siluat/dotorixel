# Progress

## Currently Working On

None

## Last Completed

[170 — Constrain latch mid-stroke toggle — immediate in-flight refresh](../issues/170-constrain-latch-mid-stroke-refresh.md): toggling the latch during an active stroke now fires the same modifier-change notification as keyboard Shift, so the in-flight shape re-resolves with the pointer stationary. Completes parent PRD [168 — Touch modifier alternatives](../issues/168-touch-modifier-alternatives.md) — the latch has full keyboard-Shift parity.

## Next Up

- Constrain latch follow-ups (port of #265's strengths): start at [172 — shared contract tests](../issues/172-toolbar-constrain-latch-contract-tests.md) (unblocks 173 → 174); [175 — snapshot guard + wording](../issues/175-constrain-latch-snapshot-guard.md) is independent
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
