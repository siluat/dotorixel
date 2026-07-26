# Progress

## Currently Working On

Apple Phase 3 — Layer system ([RFC](../issues/013-apple-native-catchup.md))
— 2/5 sub-issues done (256, 257). Frontier:
[258 — Apple layer panel rows](../issues/258-apple-layer-panel-rows.md),
now unblocked; 259–260 wait on 258.

## Last Completed

[257 — Apple editor on the Document model](../issues/257-apple-document-editor-state.md):
the Apple editor now runs on Document + DocumentHistory with single-layer
regression parity — resize became undoable (web parity), sampling and the
Metal render path read the composite, and the canvas-snapshot history path
(AppleHistoryManager) was removed as the contract step. The layer panel UI
(258–260) builds on this.

## Next Up

- [258 — Apple layer panel — rows, active selection, visibility](../issues/258-apple-layer-panel-rows.md) — Phase 3 frontier
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
