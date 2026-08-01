# Progress

## Currently Working On

Apple Phase 3 — Layer system ([RFC](../issues/013-apple-native-catchup.md))
— 4/6 sub-issues done (256–259). Frontier:
[261 — Timeline panel shell](../issues/261-apple-timeline-panel-shell.md)
(new — layer sidebar moves to its final home), then
[260 — reorder](../issues/260-apple-layer-reorder.md) (now blocked by 261).

## Last Completed

[259 — Apple layer panel — add and remove layers](../issues/259-apple-layer-add-remove.md):
the full layer workflow is live through UI alone (add/remove with web-parity
history semantics; the mid-stroke seal extends to add). Notable: a
placement review with the user superseded 258's "migrate at Phase 6" note —
the layer UI moves to a Timeline panel shell now (issue 261), and the RFC's
layout-reference wording was corrected accordingly.

## Next Up

- [261 — Apple Timeline panel shell — layer sidebar at its final home](../issues/261-apple-timeline-panel-shell.md) — Phase 3 frontier; blocks 260
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
