# Progress

## Currently Working On

Reference Layer type — tracing reference for pixel artwork ([PRD](../issues/105-reference-layer-type.md)). 5/20 sub-issues done (106 UX, 107 umbrella, 108 placement, 109 sampler, 110 Document add/composite); 15 implementation slices (111–125) remain. 111 (`set_reference_placement` + resize transform) and 112 (`try_get_pixel`) are now the parallel-ready Rust slices.

## Last Completed

[110 — Rust core: `add_reference_layer` + composite paths + kind-aware accessors](../issues/110-reference-layer-document-add-and-composite-paths.md). Locks in the integration-level deep-module test for `LayerKind` enum branching: drawing methods stop panicking on Reference-active and now return `DrawError::LayerKindMismatch` / `false` / no-op per call. `composite()` includes Reference Layers via the sampler; `composite_for_export()` excludes them.

## Next Up

- 111 — Rust core: `set_reference_placement` + resize-anchor transform
- 112 — Rust core: `Document.try_get_pixel` (sampling-aware accessor)
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (on hold; shape tools not on Apple yet)
