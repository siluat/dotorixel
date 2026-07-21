# Progress

## Currently Working On

None.

## Last Completed

[245 — Apple multi-touch stroke routing](../issues/245-apple-multitouch-stroke-routing.md):
Apple strokes now bind to their Originating Touch; a second finger ends the stroke and yields to
gestures, and the finger begin is deferred so a pinch start never paints (web parity). Bonus: a
lone resting finger no longer disturbs a pencil stroke. Known gap for the palm-rejection work:
recognizer-claimed touches escape the down-count, so a third finger mid-pinch can still draw.

## Next Up

- Apple Phase 3 — Layer system ★ foundation — needs `/to-issues` decomposition ([RFC](../issues/013-apple-native-catchup.md))
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
- Apple Pencil: hover preview + palm rejection — input routing seam ready (245)
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
