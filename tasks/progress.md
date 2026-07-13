# Progress

## Currently Working On

None

## Last Completed

[225 — Apple size-adaptive docked layout](../issues/225-apple-responsive-docked-layout.md): the Apple docked layout now adapts across iPad (wide) and Mac (x-wide) via a `LayoutTier` resolved at the 1440pt boundary, matching the web's panel/bar sizing. iPad-compact is deferred (needs the not-yet-built mobile paradigm — it only clamps gracefully); rendered-layout verification is deferred to issue 226 (Apple view snapshot infra).

## Next Up

- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
- [226 — Apple view test infrastructure (snapshot testing)](../issues/226-apple-view-test-infrastructure.md) — ready-for-agent
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
