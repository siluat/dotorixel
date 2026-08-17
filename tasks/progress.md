# Progress

## Currently Working On

Apple Native Phase 6 — Animation + extended export
([RFC](../issues/013-apple-native-catchup.md)); 5 of 14 sub-issues done.
287 closed the duration editor, so the animation track now forks: 292
(persistence) is unblocked, 288 opens the playback chain, and the export
track still opens at 293.

## Last Completed

[287 — Apple per-frame duration](../issues/287-apple-frame-duration.md): the
Timeline corner edits the active frame's duration with the web's draft-commit
semantics, and the 1–60 000 ms range stays binding-owned (core promotion
declined — its condition is still unmet). A mid-edit frame switch commits to
the frame the edit was typed for, which SwiftUI needs an explicit guard to
match (the web gets it from blur ordering). Durations are unpersisted until
292, and the field's input feel wants a hands-on pass alongside 286's gesture.

## Next Up

- [292 — Apple animation persistence](../issues/292-apple-animation-persistence.md) — persists the frame axis (order + durations); newly unblocked
- [288 — Apple playback controller](../issues/288-apple-playback-controller.md) — opens 289/290
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
- Web session-save gaps mirrored from the 265 review — unstored-tab skip + shared-state document rewrite
- Core/wasm `from_drag` span hardening — checked wide arithmetic if an unbounded coordinate source ever appears
- Flaky e2e: Reference Window reload persistence — investigate if it recurs
