# Progress

## Currently Working On

Apple Pencil — hover preview + palm rejection ([PRD](../issues/251-apple-pencil-hover-palm-rejection.md))
— 1/4 sub-issues done (252 palm rejection); 253 (hover preview) is now unblocked.

## Last Completed

[252 — Apple Pencil contact priority](../issues/252-apple-pencil-contact-priority.md):
A touching pencil now outranks direct touches in the Apple shell — a resting palm can neither
block, cut, nor pollute a pencil stroke, and pinch/pan stay suppressed until the pencil lifts.
The episode rule now binds finger begins only (a pencil begin is always admitted). Recognizer
interplay on real hardware is deferred to 255; the 253 hover recognizer needs an exemption in
the view-level gesture gate.

## Next Up

- Apple Phase 3 — Layer system ★ foundation — needs `/to-issues` decomposition ([RFC](../issues/013-apple-native-catchup.md))
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
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
- Web pen priority — palm rejection + hover target cell (web counterpart of 252–254)
