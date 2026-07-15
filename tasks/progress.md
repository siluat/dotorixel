# Progress

## Currently Working On

Apple Phase 2 — full tool set + color ([RFC](../issues/013-apple-native-catchup.md))
— sub-issue 230 done (1/13); the stroke-session seam is in place, unblocking
231 / 232 / 233 / 236 / 239.

## Last Completed

[230 — Apple stroke sessions](../issues/230-apple-stroke-sessions.md): every
Apple-shell stroke now runs through a per-stroke session (start → draw* →
end/cancel) resolved from a shell-owned tool identity, with the seam
test-proven for deferred-commit lifecycles. Draw color/tool are captured at
stroke begin (web parity), and `touchesCancelled` routes through cancel.

## Next Up

- [231 — Shape tools (line/rect/ellipse)](../issues/231-apple-shape-tools.md)
- [232 — Flood fill tool](../issues/232-apple-flood-fill.md)
- [233 — FG/BG color pair + swap + right-click BG](../issues/233-apple-fg-bg-colors.md)
- [236 — Move tool](../issues/236-apple-move-tool.md)
- [239 — Pixel-perfect filtering + toggle](../issues/239-apple-pixel-perfect.md)
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
