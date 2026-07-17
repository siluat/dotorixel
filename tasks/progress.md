# Progress

## Currently Working On

None

## Last Completed

[247 — Dead `commitFloatingSelection` effect](../issues/247-dead-commit-floating-selection-effect.md):
the unemitted tool effect is gone, so `commitIfPending` is now the only external
way to commit a Floating Selection — no tool can bypass the `isDrawing` seal
mid-stroke. The tool-seam counterpart to what 246 did for history recording, and
the last latent hazard found in the 244 audit. Apple Phase 2
([RFC](../issues/013-apple-native-catchup.md)) resumes — 230–233 done (4/13).

## Next Up

- [234 — Eyedropper tool](../issues/234-apple-eyedropper.md) — unblocks 235, 237, 241
- [236 — Move tool](../issues/236-apple-move-tool.md) — build its session on the Edit Baseline seam
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
