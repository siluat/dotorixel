# Progress

## Currently Working On

Apple Native Phase 6 — Animation + extended export
([RFC](../issues/013-apple-native-catchup.md)); 2 of 14 sub-issues done.
The Timeline panel now carries a real frame axis, so the animation track
opens at 285 and 287 in parallel; the export track still opens at 293.

## Last Completed

[284 — Apple frame ruler + Active Frame](../issues/284-apple-frame-ruler.md):
the Timeline panel's placeholder frame area is now a live ruler over the
Cel grid, and switching frames commits a pending Floating Selection
without touching History. The panel grew to 265pt to seat the ruler and
289's reserved transport slot. Frame columns still clip instead of
scrolling horizontally — carried into 285, which is what first makes a
wide axis reachable.

## Next Up

- [285 — Apple frame operations (add/duplicate/remove)](../issues/285-apple-frame-operations.md) — Phase 6 animation track, unblocked by 284
- [287 — Apple per-frame duration UI](../issues/287-apple-frame-duration.md) — unblocked by 284 (∥ 285); re-decides the binding-owned duration clamp
- [293 — Apple UniFFI export encoder bindings](../issues/293-apple-uniffi-export-encoder-bindings.md) — Phase 6 export track opener
- [255 — Apple Pencil device verification (HITL)](../issues/255-apple-pencil-device-verification.md)
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
- Document rename — spans both shells' saved-work browsers
- Document error conditions on `PixelCanvas` public API
- IndexedDB quota exceeded error handling
- Canvas resize via border drag
- Timelapse recording
- TimelinePanel mobile touch targets — frame + row icon buttons ≥44px on the mobile Timeline tab
- Web pen priority — palm rejection + hover target cell (web counterpart of 252–254)
- Apple tab strip keyboard navigation — ArrowLeft/Right + Home/End roving focus
- Apple layer reorder — interrupted-drag recovery, shared with the 280 placement overlay
- Apple bindings staleness guard — regenerate Swift bindings on binding-surface change; hit again in 284
- Web hydration opacity validation — port the Apple `from_layers` opacity guard
- Web session-save gaps mirrored from the 265 review — unstored-tab skip + shared-state document rewrite
