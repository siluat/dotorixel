# Progress

## Currently Working On

None

## Last Completed

[173 — Tool selection radiogroup semantics + live-region Constrain announcements](../issues/173-toolbar-radiogroup-live-region.md): both toolbars now expose tool selection as an ARIA radiogroup (aria-checked + roving tabindex + arrow-key nav) and announce the Constrain latch through a polite live region; the `(Constrain)` accessible-name suffix is gone. Unblocks 174. Post-merge: manual VoiceOver smoke check still pending.

## Next Up

- Constrain latch follow-ups (port of #265's strengths): [174 — 44px touch targets + strip width](../issues/174-toolbar-touch-targets-strip-overflow.md) (now unblocked by 173); [175 — snapshot guard + wording](../issues/175-constrain-latch-snapshot-guard.md) is independent
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
