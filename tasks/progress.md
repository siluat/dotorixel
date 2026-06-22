# Progress

## Currently Working On

Per-frame speed control — per-frame duration (M4) ([PRD](../issues/193-per-frame-speed-control.md)). **4 / 5 sub-issues done** — 194 design + 195 core + 196 WASM binding/journal + 197 schema V7/persistence shipped. Final slice: **[198 — TimelinePanel control + i18n + E2E](../issues/198-frame-duration-timeline-ui.md)**, now unblocked (its 194 / 196 / 197 blockers are all done).

## Last Completed

[197 — Document schema V7 + snapshot persistence](../issues/197-frame-duration-schema-v7.md): per-frame duration now survives a refresh — `FrameRecord.durationMs` round-trips through the workspace snapshot and a `DB_VERSION` 7 record, with a lossless V6 → V7 migration that backfills every legacy frame at the 100ms default. The duration clamp stays single-sourced at the WASM boundary; only the timeline control (198) remains.

## Next Up

- **198 — TimelinePanel control + i18n + E2E** ([issue](../issues/198-frame-duration-timeline-ui.md)) — active PRD's final slice, now unblocked by 197
- Timeline UI (M4 — transport/playback strip; the ruler already reserves its slot)
- Onion skinning (M4 — needs per-arbitrary-frame composite)
- Animation preview — play/pause in editor (M4)
- GIF / spritesheet export (M4 — multi-frame export)
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
