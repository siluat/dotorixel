# Progress

## Currently Working On

Apple Pencil — hover preview + palm rejection ([PRD](../issues/251-apple-pencil-hover-palm-rejection.md))
— 2/4 sub-issues done (252 palm rejection, 253 hover preview); 254 (hover gate:
block finger begins while hovering) is now unblocked, 255 (device pass) waits on 254.

## Last Completed

[253 — Apple Pencil hover preview](../issues/253-apple-pencil-hover-preview.md):
EditorState now publishes a **Hover Point** (the in-bounds canvas cell a hovering
pencil targets, else nil) that a pencil-only hover recognizer feeds and a SwiftUI
overlay highlights, glued to the cell through pan/zoom. It clears on stroke begin,
hover exit, or off-canvas. The visibility contract is pinned by state-seam tests;
finger/pointer exclusion and live-tracking/glue verification fall to the 255 device pass.

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
