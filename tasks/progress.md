# Progress

## Currently Working On

GIF/spritesheet export — multi-frame export formats ([PRD](../issues/213-gif-spritesheet-export.md)). PRD published and broken into 3 AFK sub-issues (0/3 done): [214 prefactor](../issues/214-export-format-source-prefactor.md) is unblocked and up next; 215 spritesheet and 216 GIF ride it in parallel.

## Last Completed

[212 — Extract Reorder Interaction module from TimelinePanel](../issues/212-extract-reorder-interaction.md): the twin layer/frame drag machines are now one headless `src/lib/gestures` module behind two adapters; the ~20 drag/keyboard behavior cases moved to headless unit tests. Observable behavior unchanged (old 103-test component suite passed against the new wiring before trimming); frame keyboard reorder is now possible but deliberately unwired.

## Next Up

- Onion skinning (M4 — multi-frame; `composite_at` seam available)
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
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
