# Progress

## Currently Working On

Apple Native Phase 6 — Animation + extended export
([RFC](../issues/013-apple-native-catchup.md)); 3 of 14 sub-issues done.
Multi-frame documents are now reachable from the UI, so the animation track
opens wide — 286, 287, and 288 are all unblocked; the export track still
opens at 293.

## Last Completed

[285 — Apple frame operations](../issues/285-apple-frame-operations.md): the
Timeline header carries undoable add/duplicate/remove for the Active Frame, and
the frame axis scrolls horizontally with the ruler pinned to the grid's offset.
Occupancy no longer rescans the axis per stroke sample — the mid-stroke seal
makes the stroke's own Cel the only one that can change, and the projection
patches just that one. Horizontal scrolling itself has no automated coverage
(static snapshots cannot show it), and frames are still not persisted until 292.

## Next Up

- [286 — Apple frame drag reorder](../issues/286-apple-frame-reorder.md) — unblocked by 285
- [287 — Apple per-frame duration UI](../issues/287-apple-frame-duration.md) — re-decides the binding-owned duration clamp
- [288 — Apple playback controller](../issues/288-apple-playback-controller.md) — unblocked by 285; opens 289/290
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
- Apple bindings staleness guard — regenerate Swift bindings on binding-surface change; hit again in 285
- Apple auto-save failure surfacing — needs a shell logging convention first
- Web hydration opacity validation — port the Apple `from_layers` opacity guard
- Web session-save gaps mirrored from the 265 review — unstored-tab skip + shared-state document rewrite
- Core/wasm `from_drag` span hardening — checked wide arithmetic if an unbounded coordinate source ever appears
- Flaky e2e: Reference Window reload persistence — investigate if it recurs
