---
title: Deepen Reference Window Placement (2/2) — commit ops and viewport refit lifecycle
status: ready-for-agent
created: 2026-05-01
---

## What to build

Complete the deepening started in [082](./082-deepen-reference-window-placement-create-paths.md): migrate the *commit* call sites onto `commitMove` / `commitResize`, install a viewport-change refit lifecycle, and delete the render-time `fit()` projection in `ReferenceWindowOverlay.svelte` so the overlay renders stored Reference Window Placements 1:1.

Three coordinated changes:

1. **Commit-side migration.** `ReferenceWindow.svelte::handleResizePointerMove` switches to `commitResize(current, deltaX, deltaY, viewport)` invoked per move event — drag-time clamp, so resize handles can no longer escape the viewport edge during the drag. `ReferenceWindowOverlay.svelte::commitPosition` switches to `commitMove(current, state.x, state.y, viewport)` on `onMoveCommit` — release-time clamp, preserving today's "throw the window past the edge then snap back" UX for moves. Old files deleted: `compute-position-clamp.ts`, `compute-resize.ts`, and their tests. The four duplicated `clamp()` helpers in the codebase collapse to the single internal one inside `reference-window-placement.ts`.

2. **Refit lifecycle.** A new `refitAll(viewport)` operation is added on the appropriate state owner (`Workspace` or `ReferenceImagesStore` — pick during implementation; whichever already holds the per-document visible reference list). `refitAll` walks every visible reference, applies `refitPlacement`, and writes back only when the value actually changed. A `$effect` in the appropriate integration site (`+page.svelte` or `EditorController`) watches `editor.viewportSize` and calls `refitAll`.

3. **Render-time `fit()` removal.** `ReferenceWindowOverlay.svelte`'s private `fit()` function and its sibling `clamp()` helper are deleted. The overlay passes `state.x` / `state.y` / `state.width` / `state.height` directly to `<ReferenceWindow>`.

Behaviour change versus today (the agreed (B-비율유지) policy):

- A viewport shrink permanently shrinks any window that doesn't fit (proportional aspect-preserving). The shrunk size is committed to the store and dirty-marked.
- A viewport regrow does **not** restore the original size — the user must resize the window manually if they want it bigger.
- A resize whose pointer would push the handle past the viewport edge stops at the edge during the drag, instead of overshooting and being repaired only by the (now-deleted) render-time `fit()`.

## Acceptance criteria

- `ReferenceWindow.svelte::handleResizePointerMove` calls `commitResize`. The resulting `width` / `height` satisfy `≤ viewport` and `≥ MIN_WINDOW_EDGE`. `releaseResize` performs no additional clamp.
- `ReferenceWindowOverlay.svelte::commitPosition` calls `commitMove`. The store write-back fires only when the clamped value differs from the current stored value.
- Old files deleted: `compute-position-clamp.ts`, `compute-position-clamp.test.ts`, `compute-resize.ts`, `compute-resize.test.ts`. After this slice, no file outside `reference-window-placement.ts` defines a private `clamp(value, min, max)` helper for window-placement math.
- A new `refitAll(viewport)` method on `Workspace` (or `ReferenceImagesStore`) iterates every visible reference's placement, applies `refitPlacement`, and writes back only when the value differs. Each write-back triggers `markDirty(documentId)`; idempotent skips do not.
- A `$effect` in the appropriate integration site watches `editor.viewportSize` and invokes `refitAll(viewport)` on change. The effect is colocated with the other `editor.viewportSize` consumers.
- `ReferenceWindowOverlay.svelte`'s private `fit()` function and `clamp()` helper are deleted. The overlay passes the store state's geometry directly to `<ReferenceWindow>` props.
- Behaviour — viewport shrink: reference windows shrink in store with aspect preserved; the shrunk size persists across a subsequent regrow; `markDirty(documentId)` fires once per actually-changed placement and not for unchanged ones.
- Behaviour — resize handle drag past viewport edge: handle stops at the edge during the drag.
- Behaviour — move drag past viewport edge: window follows the pointer freely during the drag and snaps back to the viewport on release (today's UX preserved).
- New unit tests cover `refitAll` idempotency (no `markDirty` when no placement changes) and dirty fan-out correctness (one `markDirty` per actually-changed placement).
- `CONTEXT.md` definitions of **Reference Window Placement**, **Placement Intent**, and **Cascade Index** match the implemented behaviour.
- Manual smoke verified in a dev browser: gallery open, drag-drop import, reference move, reference resize, browser-window shrink-then-grow — all match the policy.
- `bun run check` + `bun run test` + `cargo test` green.

## Blocked by

- [082 — Deepen Reference Window Placement (1/2)](./082-deepen-reference-window-placement-create-paths.md)
