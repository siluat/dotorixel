# Progress

## Currently Working On

Apple Native: full web parity ([RFC](../issues/013-apple-native-catchup.md)) —
Phase 5's reference track has 280 done; 281 and 282 remain, and both are now
unblocked.

## Last Completed

[280 — Apple reference placement overlay](../issues/280-apple-reference-placement-overlay.md):
the Apple Reference Layer is now positioned directly on the canvas — drag,
corner scale, in-overlay pinch, arrow nudge, and fit-to-canvas, each completed
gesture one undoable Edit. Two follow-ups are recorded in the issue's Deferred
section: gesture-interruption recovery (shares its residual, and its fix, with
the Apple layer reorder backlog item) and the macOS cursor over the box.

## Next Up

- [281 — Apple navigation bounds clamp](../issues/281-apple-reference-navigation-bounds.md) — Phase 5 frontier
- [282 — Apple reference persistence](../issues/282-apple-reference-persistence.md) — unblocked by 280
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
