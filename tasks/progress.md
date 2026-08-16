# Progress

## Currently Working On

Apple Native Phase 6 — Animation + extended export
([RFC](../issues/013-apple-native-catchup.md)); 4 of 14 sub-issues done.
The animation track's structural half is finished, so 287 is now the only
thing standing between the axis and persistence (292); 288 remains open and
the export track still opens at 293.

## Last Completed

[286 — Apple frame reorder](../issues/286-apple-frame-reorder.md): ruler headers
are draggable, and the Apple shell now has one `ReorderDrag` serving both
Timeline axes the way the web does. The header resolves tap-vs-drag inside a
single gesture rather than suppressing a trailing select, which is why it is no
longer a `Button` — it trades a focus ring for that, pending the deferred
roving-focus work. The gesture's feel needs a hands-on check (unit tests pin the
geometry and the commit, not the drag), and frame order is unpersisted until 292.

## Next Up

- [287 — Apple per-frame duration UI](../issues/287-apple-frame-duration.md) — re-decides the binding-owned duration clamp; the last blocker on 292
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
- Apple layer reorder — interrupted-drag recovery, shared with the 280 placement overlay
- Apple bindings staleness guard — regenerate Swift bindings on binding-surface change; hit again in 285
- Apple auto-save failure surfacing — needs a shell logging convention first
- Web hydration opacity validation — port the Apple `from_layers` opacity guard
- Web session-save gaps mirrored from the 265 review — unstored-tab skip + shared-state document rewrite
- Core/wasm `from_drag` span hardening — checked wide arithmetic if an unbounded coordinate source ever appears
- Flaky e2e: Reference Window reload persistence — investigate if it recurs
