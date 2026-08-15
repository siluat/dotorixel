# Progress

## Currently Working On

Apple Native: full web parity ([RFC](../issues/013-apple-native-catchup.md)) —
Phase 5's reference track is down to its last item: 282 (reference
persistence), unblocked and ready.

## Last Completed

[281 — Apple navigation bounds](../issues/281-apple-reference-navigation-bounds.md):
every Apple viewport sink now clamps to canvas ∪ active-Reference footprint
through one sink, with reclamps at every bounds-shrinking event. Decision
recorded in the issue: Fit keeps framing the canvas (web parity), amending the
original acceptance criterion; the now-unused canvas-only `clampPan` binding is
noted as a review-pass shrink candidate.

## Next Up

- [282 — Apple reference persistence](../issues/282-apple-reference-persistence.md) — last Phase 5 item
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
- Document rename — now spans both shells' saved-work browsers
- Document error conditions on `PixelCanvas` public API
- IndexedDB quota exceeded error handling
- Canvas resize via border drag
- Timelapse recording
- TimelinePanel mobile touch targets — frame + row icon buttons ≥44px on the mobile Timeline tab
- Web pen priority — palm rejection + hover target cell (web counterpart of 252–254)
- Apple tab strip keyboard navigation — ArrowLeft/Right + Home/End roving focus
- Apple layer reorder — interrupted-drag recovery, now shared with the 280 placement overlay
- Apple bindings staleness guard — regenerate Swift bindings on binding-surface change
- Web hydration opacity validation — port the Apple `from_layers` opacity guard
- Web session-save gaps mirrored from the 265 review — unstored-tab skip + shared-state document rewrite
