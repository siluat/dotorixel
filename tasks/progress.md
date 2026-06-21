# Progress

## Currently Working On

Per-frame speed control — per-frame duration (M4) ([PRD](../issues/193-per-frame-speed-control.md)). **2 / 5 sub-issues done** — 194 design + [195 Rust core](../issues/195-frame-duration-core.md) shipped. Next unblocked slice: **[196 — WASM binding + journal intent + TabState](../issues/196-frame-duration-wasm-journal.md)** (unblocked by 195; owns the range clamping). Then 197 → 198 (UI also needs the done 194 design).

## Last Completed

[195 — Per-frame duration (Rust core)](../issues/195-frame-duration-core.md): every Frame now carries a display duration (default 100 ms = 10 fps) as mutable metadata — frame identity stays id-based, so a retimed frame is the same frame. The core trusts the value; the 1–60000 ms clamp is deferred to the 196 boundary. Lands dead-code-tolerant — no shell consumer yet.

## Next Up

- **196 — WASM binding + journal intent + TabState** ([issue](../issues/196-frame-duration-wasm-journal.md)) — active PRD's next slice, now unblocked by 195 (then 197 → 198)
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
