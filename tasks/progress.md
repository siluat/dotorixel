# Progress

## Currently Working On

None

## Last Completed

[166 — Seal Reference Layer Placement Invariants into the Core](../issues/166-seal-reference-placement-invariants-into-core.md): The Reference Layer Placement invariant (finite position, scale > 0) now lives in the core's validating constructor with private fields — illegal placements are unrepresentable, and adapters shrink to marshalling. Retired two review-backlog items (scale invariant, `sample_reference` → `ReferenceData::sample_at`); the wasm `cargo fmt` debt item also looks already resolved — confirm and retire.

## Next Up

- Touch modifier alternatives (touch Shift-constrain, Selection axis lock, Alt-eyedropper UI)
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
- `cargo fmt` debt in `wasm/src/lib.rs` (likely already resolved — confirm and retire)
