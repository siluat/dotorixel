# Progress

## Currently Working On

Reference Layer type — tracing reference for pixel artwork ([PRD](../issues/105-reference-layer-type.md)). 4/20 sub-issues done (106 UX, 107 umbrella, 108 placement value type, 109 sampler); 16 implementation slices (110–125) remain. 110 (Document add/composite) is now the next parallel-ready Rust slice.

## Last Completed

[109 — Rust core: nearest-neighbor sampler](../issues/109-reference-layer-nearest-neighbor-sampler.md). Integer-floor mapping with explicit f32 negative-coord guard before the u32 cast — locked in by 8 inline tests. Still dead code at the shell; first caller arrives in 110.

## Next Up

- 110 — Rust core: `Document` add/composite paths for Reference Layers
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (on hold; shape tools not on Apple yet)
