# Progress

## Currently Working On

None

## Last Completed

[082 — Deepen Reference Window Placement (1/2): introduce module and migrate create paths](../issues/082-deepen-reference-window-placement-create-paths.md) — introduced `src/lib/reference-images/reference-window-placement.ts` exposing `createPlacement` / `refitPlacement` / `commitMove` / `commitResize` over `Placement` / `PlacementIntent` / `Viewport` / `ImageSize`. Internals (`VIEWPORT_FRACTION = 0.3`, aspect-fit sizing, viewport clamp, MIN_WINDOW_EDGE floor, `clamp` helper) are now private to the module. Migrated `select-reference.ts::displayReference` and `+page.svelte::handleCanvasDrop` to call `createPlacement` directly; deleted the three replaced helpers (`compute-initial-placement`, `compute-drop-placement`, `compute-window-size`) and their tests. `commitResize` keeps the top-left anchored; `refitPlacement` re-clamps position after proportional shrink. 16 vertical-TDD specs in a new `reference-window-placement.test.ts` exercise all four functions through their public surface. `bun run check` ✅, `bun run test` ✅ (839 / 839), `cargo test` ✅ (236 / 236). User-visible behaviour unchanged.

## Next Up

- [083 — Deepen Reference Window Placement (2/2): commit ops and viewport refit lifecycle](../issues/083-deepen-reference-window-placement-commit-and-refit.md)
  - Now unblocked (082 complete). Wires `commitMove` / `commitResize` / `refitPlacement` into runtime callers and removes `compute-position-clamp.*` and `compute-resize.*`.
- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Sub-issue of [PRD 014](../issues/014-apple-native-docked-layout.md). Independent, can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Sibling of 018. Can start independently.
- Layer system: basic infrastructure (add/delete/reorder)
  - Milestone 3 next major feature. Needs a PRD before implementation.
