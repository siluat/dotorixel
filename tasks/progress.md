# Progress

## Currently Working On

Apple Phase 3 — Layer system ([RFC](../issues/013-apple-native-catchup.md))
— 1/5 sub-issues done (256). Frontier:
[257 — Apple editor on the Document model](../issues/257-apple-document-editor-state.md),
now unblocked; 258–260 wait on 257.

## Last Completed

[256 — Apple UniFFI Document bindings](../issues/256-apple-uniffi-document-bindings.md):
the UniFFI crate now exposes the core Document model and layer-aware
DocumentHistory to Swift — the expand step of the expand–contract sequence, with
existing canvas/history bindings and shell behavior untouched. The 257 editor
swap consumes this surface and performs the contract.

## Next Up

- [257 — Apple editor on the Document model — state redesign + composite render](../issues/257-apple-document-editor-state.md) — Phase 3 frontier
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
