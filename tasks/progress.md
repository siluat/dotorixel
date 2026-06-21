# Progress

## Currently Working On

Per-frame speed control — per-frame duration (M4) ([PRD](../issues/193-per-frame-speed-control.md)). **1 / 5 sub-issues done** — [194 design](../issues/194-per-frame-duration-design.md) shipped (placement: active-frame **left-corner editor**, ms input + read-only fps, 1–60000 clamp). Next unblocked slice: **[195 — Per-frame duration (Rust core)](../issues/195-frame-duration-core.md)** (no blockers). Then 196 → 197; 198 (UI) needs 196 + the now-done 194 design.

## Last Completed

[194 — Per-frame duration control design (.pen)](../issues/194-per-frame-duration-design.md): finalized the per-frame duration control spec in the FEATURE SPECS band (sibling to 187). Chose the **left-corner editor** (active-frame-only, plain ms numeric input committing on Enter/blur + read-only derived fps, clamp 1–60000 ms) over footer / header placements via HITL visual comparison. Collapsed summary gains a read-only `· <ms>`; mobile grows the ruler + corner to ≥48px (touches 187's mobile ruler — pairs with the TimelinePanel mobile touch-targets backlog). The `.pen` is committed from the Pencil worktree, not here.

## Next Up

- **195 — Per-frame duration (Rust core)** ([issue](../issues/195-frame-duration-core.md)) — active PRD's next slice, no blockers (then 196 → 197 → 198)
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
