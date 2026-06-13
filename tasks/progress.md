# Progress

## Currently Working On

None

## Last Completed

[172 — Consolidate toolbar Constrain-latch specs into a shared contract](../issues/172-toolbar-constrain-latch-contract-tests.md): the touch ToolStrip and docked LeftToolbar now run one shared, registry-derived Constrain-latch contract instead of twin specs, so the two surfaces can't drift behaviorally — and LeftToolbar gained the inactive-constrainable case it was missing. Test-only; production unchanged. Unblocks 173.

## Next Up

- Constrain latch follow-ups (port of #265's strengths): start at [173 — radiogroup semantics + live-region](../issues/173-toolbar-radiogroup-live-region.md) (now unblocked by 172; unblocks 174); [175 — snapshot guard + wording](../issues/175-constrain-latch-snapshot-guard.md) is independent
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
