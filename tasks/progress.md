# Progress

## Currently Working On

None

## Last Completed

[246 — Remove the eager push API from History](../issues/246-remove-eager-push-api.md):
`push_document` / `push_snapshot` are gone from core and both FFI bindings, so
`History::push` is private to the ring with `end_edit` as its only caller — the
Edit Baseline is now the only way to record history **by construction**, which
is what 244 left as convention. Core tests exercise the real begin/end path,
and the seam's vocabulary is `edit` throughout (`stroke` now means only the
drag gesture). Apple Phase 2 ([RFC](../issues/013-apple-native-catchup.md))
resumes — 230–233 done (4/13).

## Next Up

- [234 — Eyedropper tool](../issues/234-apple-eyedropper.md) — unblocks 235, 237, 241
- [236 — Move tool](../issues/236-apple-move-tool.md) — build its session on the Edit Baseline seam
- [238 — HSV picker](../issues/238-apple-hsv-picker.md)
- [239 — Pixel-perfect filtering + toggle](../issues/239-apple-pixel-perfect.md)
- [240 — Shift constrain + latch](../issues/240-apple-shift-constrain.md)
- (triage) [247 — Dead `commitFloatingSelection` effect](../issues/247-dead-commit-floating-selection-effect.md)
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
