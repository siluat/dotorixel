# Progress

## Currently Working On

Apple Phase 3 — Layer system ([RFC](../issues/013-apple-native-catchup.md))
— 5/6 sub-issues done (256–259, 261). Only
[260 — reorder](../issues/260-apple-layer-reorder.md) remains, and it is now
unblocked: the sidebar sits in its final home, so the drag interaction lands
where it stays.

## Last Completed

[261 — Apple Timeline panel shell](../issues/261-apple-timeline-panel-shell.md):
the layer sidebar moved from the RightPanel into a bottom-docked Timeline panel
(expand/collapse, frame area reserved as the 092 spec's M3 placeholder), so both
shells now keep layers in the same place. Two 258/259 values were corrected to
their web/spec sources while migrating — the row type scale and the disabled-icon
dimming. Collapse state is session-transient; Phase 4 owns its persistence.

## Next Up

- [260 — Apple layer panel — reorder layers](../issues/260-apple-layer-reorder.md) — last open Phase 3 sub-issue
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
- Apple bindings staleness guard — regenerate Swift bindings on binding-surface change
