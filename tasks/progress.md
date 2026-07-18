# Progress

## Currently Working On

Apple native catch-up — Phase 2
([RFC](../issues/013-apple-native-catchup.md)): 5/13 sub-issues done (230–234);
234 just unblocked 235 (loupe) and 237 (recent colors).

## Last Completed

[234 — Eyedropper tool](../issues/234-apple-eyedropper.md): Apple shell
eyedropper with web-parity drag-to-refine sampling. Color picks are not
undoable — the session never opens an Edit Baseline, so History needed no API
change. Visible feedback is the FG/BG swatch only until the loupe (235) lands;
recent colors deferred to 237.

## Next Up

- [235 — Sampling loupe](../issues/235-apple-sampling-loupe.md)
- [236 — Move tool](../issues/236-apple-move-tool.md) — build its session on the Edit Baseline seam; unblocks 241
- [237 — Recent colors](../issues/237-apple-recent-colors.md)
- [238 — HSV picker](../issues/238-apple-hsv-picker.md)
- [239 — Pixel-perfect filtering + toggle](../issues/239-apple-pixel-perfect.md)
- [240 — Shift constrain + latch](../issues/240-apple-shift-constrain.md)
- (triage) [248 — Journal tests assert internal steps](../issues/248-journal-tests-assert-internal-steps.md)
- (triage) [245 — Apple multi-touch stroke routing](../issues/245-apple-multitouch-stroke-routing.md) — coordinate with Apple Pencil palm rejection
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
