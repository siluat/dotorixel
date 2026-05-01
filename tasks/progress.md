# Progress

## Currently Working On

None

## Last Completed

[083 — Deepen Reference Window Placement (2/2): commit ops and viewport refit lifecycle](../issues/083-deepen-reference-window-placement-commit-and-refit.md) — migrated `ReferenceWindow.svelte::handleResizePointerMove` onto `commitResize` (drag-time clamp; resize handles now stop at the viewport edge during a drag) and `ReferenceWindowOverlay.svelte::commitPosition` onto `commitMove` (release-time clamp; throw-and-snap-back move UX preserved). Deleted `compute-position-clamp.{ts,test.ts}` and `compute-resize.{ts,test.ts}`; the four duplicated `clamp()` helpers collapse to the single internal one inside `reference-window-placement.ts`. Added `ReferenceImagesStore.refitAll(docId, viewport)` — iterates visible display states, applies `refitPlacement`, writes back only when geometry changes, and fires one `markDirty(docId)` per actually-changed placement. New `$effect` in `+page.svelte` calls `refitAll` whenever `editor.viewportSize` changes. Removed the render-time `fit()` projection in `ReferenceWindowOverlay.svelte`; the overlay now passes stored geometry verbatim. `viewportWidth` / `viewportHeight` promoted to required props on both components (no `Number.POSITIVE_INFINITY` sentinel). 5 new store specs cover `refitAll` idempotency and dirty fan-out; overlay tests gained "no write-back on fitting drag release" and "drag-time resize clamps at viewport edge". `bun run check` ✅, `bun run test` ✅ (836 / 836), `cargo test` ✅ (236 / 236). Manual smoke verified.

## Next Up

- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Sub-issue of [PRD 014](../issues/014-apple-native-docked-layout.md). Independent, can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Sibling of 018. Can start independently.
- Layer system: basic infrastructure (add/delete/reorder)
  - Milestone 3 next major feature. Needs a PRD before implementation.
