# Progress

## Currently Working On

Reference Layer type — tracing reference for pixel artwork ([PRD](../issues/105-reference-layer-type.md)). 1/20 sub-issues done (106 UX design); 19 implementation slices (107–125) remain, all unblocked from the design side. Three root Rust slices (107, 108, 109) can start in parallel.

## Last Completed

[106 — Reference Layer UX detail design](../issues/106-reference-layer-ux-design.md). All twelve overlay + Timeline Panel decisions are locked in `docs/pencil-dotorixel.pen` (frame at x=-430, y=37595); implementation sub-issues now have a concrete visual reference.

## Next Up

- 107 — Rust core: `Layer` umbrella refactor (`LayerKind::Pixel | Reference`)
- 108 — Rust core: `ReferencePlacement` value type (deep-module tests)
- 109 — Rust core: nearest-neighbor sampler (deep-module tests)
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (on hold; shape tools not on Apple yet)
