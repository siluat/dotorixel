# Progress

## Currently Working On

Apple Pencil — hover preview + palm rejection ([PRD](../issues/251-apple-pencil-hover-palm-rejection.md))
— 3/4 sub-issues done (252 palm rejection, 253 hover preview, 254 hover gate). Only
255 (device verification) remains: a human on-device pass (HITL) validating the
palm / hover / gesture interplay on real hardware.

## Last Completed

[254 — Apple Pencil hover gate](../issues/254-apple-pencil-hover-finger-block.md):
the routing seam now blocks direct-touch stroke begins while a pencil hovers,
completing palm rejection on hover-capable hardware — a hovering pencil renders
fingers inert to the stroke machine without ending an in-flight stroke or gating
the pencil itself. Pinned by routed-editor seam tests (pixels + history); live
gesture/hover interplay falls to the 255 device pass.

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
