# Progress

## Currently Working On

[245 — Apple multi-touch stroke routing](../issues/245-apple-multitouch-stroke-routing.md)

## Last Completed

[248 — Journal tests assert internal steps](../issues/248-journal-tests-assert-internal-steps.md):
journal tests now assert history outcomes (`canUndo`/`canRedo`, real undo restoration) instead of
History API call sequences; the one deliberate coupling — Edit Baseline ordering — is pinned by a
single dedicated contract test. Test-only, production untouched.

## Next Up

- Apple Phase 3 — Layer system ★ foundation — needs `/to-issues` decomposition ([RFC](../issues/013-apple-native-catchup.md))
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
- Apple Pencil: hover preview + palm rejection
- Feedback link to Google Form
- (review) In-editor feedback widget
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
- TimelinePanel mobile touch targets — frame + row icon buttons ≥44px on the mobile Timeline tab
