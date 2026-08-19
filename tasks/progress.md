# Progress

## Currently Working On

None

## Last Completed

[296 — Apple GIF export](../issues/296-apple-gif-export.md): the animated
GIF format joined the 294 export menu, closing Phase 6 — and with it the
whole [013 RFC](../issues/013-apple-native-catchup.md): the Apple shell is
at full web parity. No new String Catalog labels were needed ("GIF" stays
an untranslated acronym, web parity).

## Next Up

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
- Apple bindings staleness guard — regenerate Swift bindings on binding-surface change; hit again in 285 and 382
- Apple auto-save failure surfacing — needs a shell logging convention first
- Apple toggleGrid dirty marking — align with the 292 onion-skin toggle's workspace mark; check the web siblings
- Web hydration opacity validation — port the Apple `from_layers` opacity guard
- Web playback edit-guard gaps mirrored from the 288 review — nudge/paste don't stop playback
- Web session-save gaps mirrored from the 265 review — unstored-tab skip + shared-state document rewrite
- Core/wasm `from_drag` span hardening — checked wide arithmetic if an unbounded coordinate source ever appears
- Flaky e2e: Reference Window reload persistence — investigate if it recurs
