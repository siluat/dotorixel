# Progress

## Currently Working On

Apple Phase 2 — full tool set + color ([RFC](../issues/013-apple-native-catchup.md))
— sub-issues 230–231, 233 done (3/13); the FG/BG color pair landed on the
stroke seam, unblocking 234 (eyedropper) and 238 (HSV picker).

## Last Completed

[233 — Apple FG/BG colors](../issues/233-apple-fg-bg-colors.md): FG/BG pair
with web-matching defaults, swap, and right-click background drawing. The draw
color is resolved once at stroke begin on the engine seam, so fill (232)
inherits right-click behavior for free. Eyedropper BG commit stays in 234;
X-key swap in 241.

## Next Up

- [232 — Flood fill tool](../issues/232-apple-flood-fill.md)
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
