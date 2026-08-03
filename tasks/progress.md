# Progress

## Currently Working On

Apple catch-up Phase 4 — multi-tab + persistence ([RFC](../issues/013-apple-native-catchup.md), issues 262–266).
4 of 5 done (262–265); 266 is the last item, now unblocked.

## Last Completed

[265 — Apple SwiftData session auto-save + restore](../issues/265-apple-swiftdata-session-persistence.md):
debounced auto-save + launch restore over the full current Apple model.
Invariants locked in: hydration marks nothing dirty, restored history starts
empty, corrupt/empty store falls back to a fresh session. The `saved` flag is
written `false` — 266 gives it meaning.

## Next Up

- [266 — Apple save dialog + saved work browser](../issues/266-apple-save-dialog-saved-work.md) — last Phase 4 item, unblocked
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
- Feedback link to Google Form
- [255 — Apple Pencil device verification pass (HITL)](../issues/255-apple-pencil-device-verification.md) — waiting on real-hardware access
- (review) In-editor feedback widget
- Reference image window polish — opacity slider, lock toggle, flip H/V, rotate
- Reference image import — clipboard paste support
- Design: share artwork dialog — URL sharing dialog UI (.pen)
- Share artwork via URL
- FG/BG swap UI improvements
- Dark mode toggle UI
- Document error conditions on `PixelCanvas` public API
- IndexedDB quota exceeded error handling
- Document rename
- Canvas resize via border drag
- Timelapse recording
- TimelinePanel mobile touch targets — frame + row icon buttons ≥44px on the mobile Timeline tab
- Web pen priority — palm rejection + hover target cell (web counterpart of 252–254)
- Apple tab strip keyboard navigation — ArrowLeft/Right + Home/End roving focus
- Apple layer reorder — interrupted-drag recovery
- Apple layer panel predicates — `canReorderLayers` vs `canRemoveLayer` number consistency
- Apple bindings staleness guard — regenerate Swift bindings on binding-surface change
- Apple auto-save failure surfacing — silent retry today; log + notification later
- Web hydration opacity validation — port the Apple `from_layers` opacity guard
- Flaky e2e: Reference Window reload persistence — investigate if it recurs
