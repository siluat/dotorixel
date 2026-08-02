# Progress

## Currently Working On

Apple catch-up Phase 4 — multi-tab + persistence ([RFC](../issues/013-apple-native-catchup.md), issues 262–266).
3 of 5 done (262–264); frontier is 265, now fully unblocked — 266 waits behind it.

## Last Completed

[264 — Apple multi-tab workspace UI](../issues/264-apple-multi-tab-workspace.md):
SwiftUI tab strip with add/switch/close on the 262 state split — activation
commits the outgoing tab's in-flight stroke, and closing shows an interim
discard confirm until 266's save dialog replaces it.

## Next Up

- [265 — Apple SwiftData session auto-save + restore](../issues/265-apple-swiftdata-session-persistence.md) — Phase 4 frontier; last blocker of 266
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
- Apple layer reorder — interrupted-drag recovery
- Apple layer panel predicates — `canReorderLayers` vs `canRemoveLayer` number consistency
- Apple bindings staleness guard — regenerate Swift bindings on binding-surface change
- Flaky e2e: Reference Window reload persistence — investigate if it recurs
