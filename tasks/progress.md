# Progress

## Currently Working On

Apple Native Phase 6 — Animation + extended export
([RFC](../issues/013-apple-native-catchup.md)); 1 of 14 sub-issues done.
The animation track's binding layer is in, so 284 (frame ruler) is
unblocked; the export track still opens at 293.

## Last Completed

[283 — Apple UniFFI frame bindings](../issues/283-apple-uniffi-frame-bindings.md):
the Apple binding now carries the whole frame axis — metadata, operations,
per-frame duration, and frame-addressed composite — with no core change and
no shell change. The duration clamp range stays binding-owned and duplicated
with wasm on purpose; 287 is where that gets re-decided.

## Next Up

- [284 — Apple frame ruler + Active Frame](../issues/284-apple-frame-ruler.md) — Phase 6 animation track, unblocked by 283
- [293 — Apple UniFFI export encoder bindings](../issues/293-apple-uniffi-export-encoder-bindings.md) — Phase 6 export track opener (∥ 284)
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
- Apple bindings staleness guard — regenerate Swift bindings on binding-surface change
- Web hydration opacity validation — port the Apple `from_layers` opacity guard
- Web session-save gaps mirrored from the 265 review — unstored-tab skip + shared-state document rewrite
