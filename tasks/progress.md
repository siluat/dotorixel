# Progress

## Currently Working On

Touch modifier alternatives — touch-reachable Shift-constrain ([PRD](../issues/168-touch-modifier-alternatives.md)). PRD authored and decomposed into 3 sub-issues (169–171); all ready-for-agent. Next implementable: [169 — Constrain latch + touch tool strip toggle](../issues/169-constrain-latch-touch-toggle.md) (no blockers; 170 and 171 are blocked by it).

## Last Completed

[167 — Retire the workspace cargo fmt debt](../issues/167-workspace-cargo-fmt-debt.md): The wasm half was already resolved; the same debt had moved to `apple/src/lib.rs`, so the item was widened to workspace scope and `cargo fmt --check` now passes workspace-wide. Note: no hook/CI enforces workspace fmt — this debt accumulated silently twice.

## Next Up

- Copy/paste
- Flip/transform
- Project file format (JSON-based) + save/load
- Apple Pencil: hover preview + palm rejection
- Feature guide page (basic usage instructions)
- (review) In-editor feedback widget
- Frame management (add/delete/duplicate/reorder)
- Feedback link to Google Form
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
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
