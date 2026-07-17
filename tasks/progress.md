# Progress

## Currently Working On

None

## Last Completed

[243 — No-op strokes push empty undo entries](../issues/243-no-op-stroke-history-entries.md):
strokes now commit their undo entry at stroke end only when they changed the
document (core-owned Stroke Baseline, both shells in one change) — no-op
strokes leave History untouched and no longer destroy the redo future.
Command-path no-op gaps split to 244. Apple Phase 2
([RFC](../issues/013-apple-native-catchup.md)) resumes — 230–233 done (4/13).

## Next Up

- [244 — Command no-ops still push history entries](../issues/244-command-noop-history-entries.md)
  — ready-for-agent; triaged to land **before 236** (renames the seam 236 builds on)
- [234 — Eyedropper tool](../issues/234-apple-eyedropper.md)
- [236 — Move tool](../issues/236-apple-move-tool.md) — build its session on the 244 Edit Baseline seam
- [238 — HSV picker](../issues/238-apple-hsv-picker.md)
- [239 — Pixel-perfect filtering + toggle](../issues/239-apple-pixel-perfect.md)
- [240 — Shift constrain + latch](../issues/240-apple-shift-constrain.md)
- (triage) [246 — Remove the eager push API from History](../issues/246-remove-eager-push-api.md) — blocked by 244
- (triage) [247 — Dead `commitFloatingSelection` effect](../issues/247-dead-commit-floating-selection-effect.md)
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
