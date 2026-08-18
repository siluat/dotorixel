# Progress

## Currently Working On

Apple Native Phase 6 — Animation + extended export
([RFC](../issues/013-apple-native-catchup.md)); 7 of 14 sub-issues done.
289 closed the transport strip, so 291 (onion skin render) now waits only
on 290 (onion skin state); 292 (persistence) stays open in parallel, and
the export track still opens at 293.

## Last Completed

[289 — Apple transport strip](../issues/289-apple-transport-strip.md):
Play/Pause, Loop, and the position readout over the 288 engine, with the
Playhead marked by an inset accent ring on the ruler header (the
fixed-height panel's stand-in for the web's ▼ lane). The snapshot pinned
host is re-pinned to iOS 26.5 (all prior baselines verified unchanged
first). Two hands-on checks stay open: macOS timer-fallback smoothness
and the Loop toggle's VoiceOver announcement on device.

## Next Up

- [290 — Apple onion skin state](../issues/290-apple-onion-skin-state.md) — last blocker before 291
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
- Apple bindings staleness guard — regenerate Swift bindings on binding-surface change; also fix the silent bootstrap death on a missing `apple/generated` (hit in 289 setup)
- Apple auto-save failure surfacing — needs a shell logging convention first
- Web hydration opacity validation — port the Apple `from_layers` opacity guard
- Web playback edit-guard gaps mirrored from the 288 review — nudge/paste don't stop playback
- Web session-save gaps mirrored from the 265 review — unstored-tab skip + shared-state document rewrite
- Core/wasm `from_drag` span hardening — checked wide arithmetic if an unbounded coordinate source ever appears
- Flaky e2e: Reference Window reload persistence — investigate if it recurs
