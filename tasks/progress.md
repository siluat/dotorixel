# Progress

## Currently Working On

Reference Layer type — tracing reference for pixel artwork ([PRD](../issues/105-reference-layer-type.md)). 20 sub-issues (106–125) filed, all `needs-triage`; four root-blocker slices (106 design, 107 LayerKind umbrella, 108 ReferencePlacement, 109 NN sampler) can start in parallel.

## Last Completed

Filed PRD-105 sub-issues 106–125 — single HITL design slice + 19 AFK implementation slices covering Rust core (umbrella + sampler + Document API), WASM/TS bindings, V3→V4 persistence, export call-site update, Timeline Panel additions, placement overlay (shell → drag → Shift-snap → keyboard nudge), and drawing/sampling tool kind-routing. Dependency graph encoded in each issue's "Blocked by".

## Next Up

- 106 — Reference Layer UX detail design (HITL: Timeline Panel additions + placement overlay)
- 107 — Rust core: `Layer` umbrella refactor (`LayerKind::Pixel | Reference`)
- 108 — Rust core: `ReferencePlacement` value type (deep-module tests)
- 109 — Rust core: nearest-neighbor sampler (deep-module tests)
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (on hold; shape tools not on Apple yet)
