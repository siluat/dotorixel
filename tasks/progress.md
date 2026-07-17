# Progress

## Currently Working On

[243 — No-op strokes push empty undo entries](../issues/243-no-op-stroke-history-entries.md)
— backlog bug prioritized over Phase 2; deferred stroke commit in core
(Stroke Baseline), lands on both shells in one change. Apple Phase 2
([RFC](../issues/013-apple-native-catchup.md)) paused — 230–233 done (4/13),
resume with 234/236/238/239/240.

## Last Completed

[232 — Apple flood fill](../issues/232-apple-flood-fill.md): one-shot fill on
the stroke-session seam, core algorithm exposed over FFI rather than
reimplemented in Swift. Right-click background fill arrived free via the 233
draw-color seam, as predicted; pinned by a regression test.

## Next Up

- [234 — Eyedropper tool](../issues/234-apple-eyedropper.md)
- [236 — Move tool](../issues/236-apple-move-tool.md)
- [238 — HSV picker](../issues/238-apple-hsv-picker.md)
- [239 — Pixel-perfect filtering + toggle](../issues/239-apple-pixel-perfect.md)
- [240 — Shift constrain + latch](../issues/240-apple-shift-constrain.md)
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
- Apple Pencil: hover preview + palm rejection
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
