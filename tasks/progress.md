# Progress

## Currently Working On

Reference Layer type — tracing reference for pixel artwork ([PRD](../issues/105-reference-layer-type.md)). 6/20 sub-issues done (106 UX, 107 umbrella, 108 placement, 109 sampler, 110 Document add/composite, 111 set_placement+resize). 112 (`try_get_pixel`) is the last parallel-ready Rust slice; 113 (WASM facade) unblocks once 112 lands.

## Last Completed

[111 — Rust core: `set_reference_placement` + 9-anchor resize placement transform](../issues/111-reference-layer-set-placement-and-resize-anchor-transform.md). Locks in `LayerError::LayerKindMismatch { id, expected, actual }` as the kind-mismatch error for id-addressed layer ops, and the anchor-factor invariant for canvas resize (placement translates by `(new − old) × anchor_factor`; scale, source RGBA, and natural dimensions unchanged).

## Next Up

- 112 — Rust core: `Document.try_get_pixel` (sampling-aware accessor)
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (on hold; shape tools not on Apple yet)
