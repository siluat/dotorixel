# Progress

## Currently Working On

Apple Native Phase 6 — Animation + extended export
([RFC](../issues/013-apple-native-catchup.md)); 6 of 14 sub-issues done.
288 closed the playback engine, unblocking 289 (transport UI) and 290
(onion skin state); 292 (persistence) stays open in parallel, and the
export track still opens at 293.

## Last Completed

[288 — Apple playback controller](../issues/288-apple-playback-controller.md):
the per-tab engine previews committed art through the display-buffer seam
without touching the Active Frame, History, or dirty state; stop-hook parity
with the web is verified against its full set. The advance loop's termination
relies on the ≥ 1 ms duration clamp — 292's hydration boundary must uphold it.
Transport UI follows in 289; the macOS 60 Hz timer fallback wants a hands-on
smoothness check there.

## Next Up

- [289 — Apple transport strip UI](../issues/289-apple-transport-strip.md) — newly unblocked; opens 291 with 290
- [290 — Apple onion skin state](../issues/290-apple-onion-skin-state.md) — newly unblocked
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
