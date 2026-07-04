# Progress

## Currently Working On

None

## Last Completed

[211 — Enforce rustfmt in pre-commit and fix existing violations](../issues/211-enforce-rustfmt-pre-commit.md): the lefthook pre-commit now runs a workspace-wide `cargo fmt --check` whenever a `.rs` file is staged, and the 3 pre-existing violations are fixed — the Rust tree is formatting-clean and stays that way. rustfmt default style is the contract (no `rustfmt.toml`).

## Next Up

- Onion skinning (M4 — multi-frame; `composite_at` seam available)
- GIF / spritesheet export (M4 — multi-frame export; `composite_at` seam available)
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
- Apple Pencil: hover preview + palm rejection
- Feedback link to Google Form
- (review) In-editor feedback widget
- Selection UI stuck while a Reference Layer is active — hide the selection UI when the active layer is a Reference Layer ([issue 205](../issues/205-selection-ui-reference-layer-active.md), ready-for-agent)
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
