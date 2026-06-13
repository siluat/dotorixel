# Progress

## Currently Working On

None

## Last Completed

[174 — Guarantee 44px toolbar touch targets and resolve the strip width debt](../issues/174-toolbar-touch-targets-strip-overflow.md): both toolbars now guarantee ≥44px hit targets — the compact strip pins Undo outside a horizontal tool-scroll area, and the docked LeftToolbar sizes its grid column to the button (44px / 48px x-wide). The strip width-debt comment is gone. Sizing is E2E-verified (happy-dom can't measure layout). Follow-up 175 stays independent.

## Next Up

- Constrain latch follow-up (port of #265's strengths): [175 — snapshot guard + wording](../issues/175-constrain-latch-snapshot-guard.md) is independent and ready
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
