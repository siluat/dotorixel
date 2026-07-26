# Progress

## Currently Working On

Apple Phase 3 — Layer system ([RFC](../issues/013-apple-native-catchup.md))
— decomposed into sub-issues 256–260 (2026-07-26); none started yet. Frontier:
[256 — UniFFI Document bindings](../issues/256-apple-uniffi-document-bindings.md).

## Last Completed

[254 — Apple Pencil hover gate](../issues/254-apple-pencil-hover-finger-block.md):
the routing seam now blocks direct-touch stroke begins while a pencil hovers,
completing palm rejection on hover-capable hardware — a hovering pencil renders
fingers inert to the stroke machine without ending an in-flight stroke or gating
the pencil itself. Pinned by routed-editor seam tests (pixels + history); live
gesture/hover interplay falls to the 255 device pass.

## Next Up

- [255 — Apple Pencil device verification pass (HITL)](../issues/255-apple-pencil-device-verification.md) — deferred until real-hardware access; last open sub-issue of the 251 PRD
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
