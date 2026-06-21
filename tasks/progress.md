# Progress

## Currently Working On

Per-frame speed control — per-frame duration (M4) ([PRD](../issues/193-per-frame-speed-control.md)). **3 / 5 sub-issues done** — 194 design + 195 core + [196 WASM binding/journal/TabState](../issues/196-frame-duration-wasm-journal.md) shipped. Next unblocked slice: **[197 — Document schema V7 + snapshot persistence](../issues/197-frame-duration-schema-v7.md)** (unblocked by 196). Then 198 (TimelinePanel UI; also needs the done 194 design).

## Last Completed

[196 — Per-frame duration WASM binding + journal intent + TabState](../issues/196-frame-duration-wasm-journal.md): the web shell can now read each frame's `duration_ms` and retime it through an undoable `set-frame-duration` journal intent (one commit = one undo step, no viewport reclamp). The 1–60000 ms clamp is single-sourced at the WASM boundary; snapshot persistence (197) and the timeline control (198) remain.

## Next Up

- **197 — Document schema V7 + snapshot persistence** ([issue](../issues/197-frame-duration-schema-v7.md)) — active PRD's next slice, now unblocked by 196 (then 198)
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
