# Progress

## Currently Working On

Apple Native Phase 6 — Animation + extended export
([RFC](../issues/013-apple-native-catchup.md)); 8 of 14 sub-issues done.
290 unblocked 291 (onion skin render + toggle, the animation track's last
UI slice); 292 (persistence) stays open in parallel, and the export track
still opens at 293.

## Last Completed

[290 — Apple onion skin state](../issues/290-apple-onion-skin-state.md):
pure neighbor selection plus the per-tab toggle and ghost projection over
the neighbors' committed composites, proven through the real bindings to be
a pure read (no history, no dirty, no Active-Frame moves) that empties
during Playback. The toggle is in-memory by design — persistence rides 292;
pixels on screen ride 291.

## Next Up

- [291 — Apple onion skin render + toggle](../issues/291-apple-onion-skin-render.md) — render + transport toggle over the 290 state
- [292 — Apple animation persistence](../issues/292-apple-animation-persistence.md) — persists the frame axis (order + durations)
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
- Apple drag interruption recovery — one `scenePhase` guard for all three drag surfaces (layer rows, frame ruler, 280 placement overlay)
- Apple bindings staleness guard — regenerate Swift bindings on binding-surface change; hit again in 285
- Apple auto-save failure surfacing — needs a shell logging convention first
- Web hydration opacity validation — port the Apple `from_layers` opacity guard
- Web playback edit-guard gaps mirrored from the 288 review — nudge/paste don't stop playback
- Web session-save gaps mirrored from the 265 review — unstored-tab skip + shared-state document rewrite
- Core/wasm `from_drag` span hardening — checked wide arithmetic if an unbounded coordinate source ever appears
- Flaky e2e: Reference Window reload persistence — investigate if it recurs
