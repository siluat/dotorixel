# Progress

## Currently Working On

None

## Last Completed

Architecture deepening planning — surveyed the Reference Window placement modules and identified hidden invariants (aspect lock, `MIN_WINDOW_EDGE` floor, viewport clamp, cascade stagger) split across 4 duplicated `clamp()` helpers and 5 `compute-*` modules. Designed a calculator-style `reference-window-placement.ts` module with `createPlacement` / `refitPlacement` / `commitMove` / `commitResize` and the (B-비율유지) viewport-shrink policy (proportional aspect-preserving shrink committed to store; regrow does not restore). Filed as two ready-for-agent slices: [082](../issues/082-deepen-reference-window-placement-create-paths.md) (introduce module, migrate create paths) and [083](../issues/083-deepen-reference-window-placement-commit-and-refit.md) (commit ops + viewport refit lifecycle). Seeded `Reference Window`, `Reference Window Placement`, `Placement Intent`, `Cascade Index` in `CONTEXT.md`.

## Next Up

- [082 — Deepen Reference Window Placement (1/2): introduce module and migrate create paths](../issues/082-deepen-reference-window-placement-create-paths.md)
  - Ready-for-agent, no blockers. Implementation slice.
- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Sub-issue of [PRD 014](../issues/014-apple-native-docked-layout.md). Independent, can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Sibling of 018. Can start independently.
- Layer system: basic infrastructure (add/delete/reorder)
  - Milestone 3 next major feature. Needs a PRD before implementation.
