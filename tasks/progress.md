# Progress

## Currently Working On

Reference Layer type — tracing reference for pixel artwork ([PRD](../issues/105-reference-layer-type.md)). 2/20 sub-issues done (106 UX, 107 `LayerKind` umbrella); 18 implementation slices (108–125) remain. Two root Rust slices (108, 109) still unblocked in parallel; 110 (composite/sampling integration) now ready since 107 landed the Reference variant.

## Last Completed

[107 — Rust core: `Layer` umbrella refactor (`LayerKind::Pixel | Reference`)](../issues/107-reference-layer-kind-umbrella-refactor.md). Reference variant is structurally present but dead-code at the shell — wasm/TS still see Pixel-only. Pixel-active invariant guarded by `unreachable!` until UI surfaces Reference Layers.

## Next Up

- 108 — Rust core: `ReferencePlacement` value type (deep-module tests)
- 109 — Rust core: nearest-neighbor sampler (deep-module tests)
- 110 — Rust core: `Document` add/composite paths for Reference Layers
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (on hold; shape tools not on Apple yet)
