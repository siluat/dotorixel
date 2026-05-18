# Progress

## Currently Working On

Reference Layer type — tracing reference for pixel artwork ([PRD](../issues/105-reference-layer-type.md)). 3/20 sub-issues done (106 UX, 107 umbrella, 108 placement value type); 17 implementation slices (109–125) remain. 109 (sampler) and 110 (Document add/composite) are the parallel-ready Rust root slices.

## Last Completed

[108 — Rust core: `ReferencePlacement` value type](../issues/108-reference-placement-value-type.md). Three value-pure builders (`with_position`, `with_scale`, `restore_to_natural`) with center-preservation locked in by inline tests. Still dead-code at the shell — first user-visible callers arrive in 110/111/119.

## Next Up

- 109 — Rust core: nearest-neighbor sampler (deep-module tests)
- 110 — Rust core: `Document` add/composite paths for Reference Layers
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (on hold; shape tools not on Apple yet)
