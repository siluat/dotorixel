# Progress

## Currently Working On

Reference Layer type — tracing reference for pixel artwork ([PRD](../issues/105-reference-layer-type.md)). 10/20 sub-issues done; V4 persistence now round-trips Reference Layers through storage/session hydration, so export and UI slices can build on persisted mixed layers.

## Last Completed

[115 — Reference Layer: V4 persistence end-to-end (Reference Layer round-trip)](../issues/115-reference-layer-v4-persistence-end-to-end.md). V4 storage/session hydration now preserves Pixel + Reference layer order, placement, natural dimensions, and source blobs across reload. Import UI remains in 118.

## Next Up

- 116 — Reference Layer: export call sites use the export-only composite
- 117 — Reference Layer: Timeline Panel kind icons + activation
- 120 — Reference Layer: placement overlay shell
- 125 — Reference Layer: eyedropper + sampling use active-layer optional reads
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
