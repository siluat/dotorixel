# Progress

## Currently Working On

Apple native catch-up — Phase 2
([RFC](../issues/013-apple-native-catchup.md)): 11/13 sub-issues done (230–240);
remaining: 241, then 242 closes the phase.

## Last Completed

[240 — Shift constrain + latch](../issues/240-apple-shift-constrain.md):
Shift and the toolbar Constrain latch are OR-combined at one session seam
(latch = re-tap the active shape tool, web parity); mid-stroke toggles reshape
the preview instantly via a new session `modifierChanged` hook. Latch is
in-memory until Phase 4 persistence.

## Next Up

- [241 — Keyboard shortcuts](../issues/241-apple-keyboard-shortcuts.md)
- [249 — Apple hex display row](../issues/249-apple-hex-display-row.md) — web parity, unblocked by 238
- (triage) [250 — HSV picker assistive adjustability](../issues/250-hsv-picker-assistive-adjustability.md) — flagged on PR #330
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
