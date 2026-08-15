# Progress

## Currently Working On

None — Apple Native parity Phase 5 is complete; Phase 6 (animation + extended
export) awaits decomposition via `/to-tickets` when picked up.

## Last Completed

[282 — Apple reference persistence](../issues/282-apple-reference-persistence.md):
the Reference Layer joined the SwiftData schema (PNG-compressed source,
optional field — old stores restore unchanged), closing Phase 5. Corruption
drops only the reference, never the session; decision log covers the
core-side PNG codec and the single `fromLayers(reference:)` hydration path.

## Next Up

- Apple Native Phase 6 — animation + extended export; decompose the RFC via `/to-tickets`
- [255 — Apple Pencil device verification (HITL)](../issues/255-apple-pencil-device-verification.md)
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
- Feedback link to Google Form
- (review) In-editor feedback widget
- Reference image window polish — opacity slider, lock toggle, flip H/V, rotate
- Reference image import — clipboard paste support
- Design: share artwork dialog — URL sharing dialog UI (.pen)
- Share artwork via URL
- FG/BG swap UI improvements
- Dark mode toggle UI
- Document rename — spans both shells' saved-work browsers
- Document error conditions on `PixelCanvas` public API
- IndexedDB quota exceeded error handling
- Canvas resize via border drag
- Timelapse recording
- TimelinePanel mobile touch targets — frame + row icon buttons ≥44px on the mobile Timeline tab
- Web pen priority — palm rejection + hover target cell (web counterpart of 252–254)
- Apple tab strip keyboard navigation — ArrowLeft/Right + Home/End roving focus
- Apple layer reorder — interrupted-drag recovery, shared with the 280 placement overlay
- Apple bindings staleness guard — regenerate Swift bindings on binding-surface change
- Web hydration opacity validation — port the Apple `from_layers` opacity guard
- Web session-save gaps mirrored from the 265 review — unstored-tab skip + shared-state document rewrite
