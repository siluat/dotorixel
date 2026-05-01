---
title: Deepen Reference Window Placement (1/2) — introduce module and migrate create paths
status: done
created: 2026-05-01
---

## What to build

Introduce a deepened calculator-style module `src/lib/reference-images/reference-window-placement.ts` to replace the five pure-math helpers (`compute-{initial-placement,drop-placement,position-clamp,resize,window-size}.ts`) that today share hidden invariants — aspect lock, `MIN_WINDOW_EDGE` floor, viewport clamp, cascade stagger — across four duplicated `clamp()` helpers without a unifying contract. The new module exposes four free functions — `createPlacement`, `refitPlacement`, `commitMove`, `commitResize` — plus the value types `Placement`, `PlacementIntent`, `Viewport`, `ImageSize`. The 30 % viewport-fraction sizing rule, `MIN_WINDOW_EDGE`, and the internal `clamp` helper become module internals.

This slice migrates **only the *create* call sites**:

- `select-reference.ts::displayReference` → `createPlacement(image, { kind: 'centered', cascadeIndex }, viewport)`.
- `+page.svelte::handleCanvasDrop` → `createPlacement(image, { kind: 'at-point', x, y }, viewport)`. The per-drop-batch cascade stays in the caller, added to `dropX`/`dropY` before each call. This is intentionally distinct from the per-document **Cascade Index** consumed by `centered` intents — the cascade policy split agreed during design (drop semantics: "user picked the position, batch-internal stagger only"; gallery semantics: "user did not pick a position, avoid covering existing windows").

Old files deleted: `compute-initial-placement.ts`, `compute-drop-placement.ts`, `compute-window-size.ts`, and their test files. The remaining helpers (`compute-position-clamp.ts`, `compute-resize.ts`) and the render-time `fit()` projection in `ReferenceWindowOverlay.svelte` stay untouched — slice 2 ([083](./083-deepen-reference-window-placement-commit-and-refit.md)) handles those.

`commitMove`, `commitResize`, and `refitPlacement` are exported and unit-tested in this slice but not yet wired into runtime callers — that's slice 2's job. Exporting them up-front locks the module's public surface in one place rather than letting it grow piecemeal.

Domain vocabulary already seeded in `CONTEXT.md`: **Reference Window**, **Reference Window Placement**, **Placement Intent**, **Cascade Index**. User-visible behaviour is unchanged in this slice.

## Acceptance criteria

- `src/lib/reference-images/reference-window-placement.ts` exports `Placement`, `PlacementIntent` (discriminated union of `centered` and `at-point`), `Viewport`, `ImageSize` types and `createPlacement`, `refitPlacement`, `commitMove`, `commitResize` functions. No callers see `MIN_WINDOW_EDGE`, the 30 % viewport-fraction constant, or the internal `clamp` helper through this module.
- `createPlacement` for a `centered` intent: aspect-preserving size (longer edge ≤ 30 % of the larger viewport edge, shorter edge ≥ `MIN_WINDOW_EDGE`, capped to viewport for extreme aspects), centered then offset by `cascadeIndex × CASCADE_OFFSET` and clamped inside the viewport.
- `createPlacement` for an `at-point` intent: same sizing rule, centered on the supplied `(x, y)` and clamped inside the viewport.
- `refitPlacement` is idempotent — when the input already fits the supplied viewport, the result is structurally equal. When the viewport is smaller, the result is an aspect-preserving proportional shrink that fits.
- `commitMove(current, x, y, viewport)` returns a placement whose `x, y` are clamped to keep the window inside the viewport; size unchanged.
- `commitResize(current, deltaW, deltaH, viewport)` applies aspect-locked corner-handle resize math (driven by the dominant axis) with `MIN_WINDOW_EDGE` floor and viewport upper bound.
- `select-reference.ts::displayReference` and `+page.svelte::handleCanvasDrop` consume `createPlacement` directly. No call site references the three deleted helpers.
- Old files deleted: `compute-initial-placement.ts`, `compute-initial-placement.test.ts`, `compute-drop-placement.ts`, `compute-drop-placement.test.ts`, `compute-window-size.ts`. (`compute-resize.ts`, `compute-position-clamp.ts`, and their tests stay until slice 2.)
- A new unit-test file `reference-window-placement.test.ts` covers all four functions: both `PlacementIntent` variants for `createPlacement`, idempotency + shrink path for `refitPlacement`, clamping for `commitMove`, aspect-lock + `MIN_WINDOW_EDGE` + viewport clamp for `commitResize`.
- `reference-window-constants.ts` retains `MIN_WINDOW_EDGE` and `CASCADE_OFFSET` for slice-2 callers (`ReferenceWindow.svelte` resize path, `+page.svelte` drop-batch cascade).
- Existing user-visible behaviour preserved: gallery open with cascade, multi-file drop with per-batch cascade, reference window move / resize / close — all identical.
- `bun run check` + `bun run test` + `cargo test` green.

## Blocked by

None — can start immediately.

## Results

| File | Description |
|------|-------------|
| `src/lib/reference-images/reference-window-placement.ts` | New deepened module — exports `Placement`, `Viewport`, `ImageSize`, `PlacementIntent` types and `createPlacement` / `refitPlacement` / `commitMove` / `commitResize` functions. Internals (`VIEWPORT_FRACTION = 0.3`, `aspectFitSize`, `anchorFor`, single `clampInsideViewport`, single `clamp`) are private. |
| `src/lib/reference-images/reference-window-placement.test.ts` | New unit-test file — 16 specs covering both `PlacementIntent` variants for `createPlacement` (incl. cascade offset, viewport clamp, MIN_WINDOW_EDGE floor, viewport-cap fallback for extreme aspects), idempotency + proportional shrink for `refitPlacement`, edge clamping for `commitMove`, and aspect-lock + floor + viewport-cap for `commitResize`. |
| `src/lib/reference-images/select-reference.ts` | `displayReference` now calls `createPlacement(image, { kind: 'centered', cascadeIndex }, viewport)`. |
| `src/routes/editor/+page.svelte` | `handleCanvasDrop` now calls `createPlacement(image, { kind: 'at-point', x, y }, viewport)` with the per-batch `CASCADE_OFFSET` applied to drop coords before each call. |
| `src/lib/reference-images/reference-images-store.svelte.ts` | `Placement` type re-imported from the new module. |
| `src/lib/reference-images/reference-window-constants.ts` | Doc comments updated to point at the new module (constants themselves unchanged). |
| `src/lib/reference-images/compute-initial-placement.ts` (deleted) | Replaced by `createPlacement` (`centered` intent). |
| `src/lib/reference-images/compute-initial-placement.test.ts` (deleted) | Replaced by `reference-window-placement.test.ts`. |
| `src/lib/reference-images/compute-drop-placement.ts` (deleted) | Replaced by `createPlacement` (`at-point` intent). |
| `src/lib/reference-images/compute-drop-placement.test.ts` (deleted) | Replaced by `reference-window-placement.test.ts`. |
| `src/lib/reference-images/compute-window-size.ts` (deleted) | Inlined as the private `aspectFitSize` helper inside the new module. |

### Key Decisions

- **Top-left stays anchored on `commitResize`.** The AC spelled out "viewport upper bound" for size only; position handling wasn't specified. Chose to keep `(current.x, current.y)` unchanged so the resize feel matches the existing `ReferenceWindow.svelte` behaviour. If a future resize anchor change is wanted, it lives behind this single function.
- **`refitPlacement` re-clamps position after shrink.** A "fit" that left the window straddling the new viewport edge wouldn't actually fit, so the function shrinks proportionally and then runs the same `clampInsideViewport` helper.
- **`commitMove`, `commitResize`, `refitPlacement` exported but not yet wired** — locks the module's public surface in one place rather than letting it grow piecemeal in slice 2.
- **Single test file for the whole module.** The four functions share the same domain types and the same internal helpers; co-located specs read as the module's behavioural contract end-to-end.

### Notes

- Caught a TDD slip on first writing the at-point centering test: the chosen point `(500, 500)` on a `1000×1000` viewport coincided with the centered-intent result, so the test passed without exercising the new branch. Strengthened to `(300, 700)`, watched it go RED, then GREEN. Worth carrying forward as a heuristic — when a test passes immediately on a code path that should still be unimplemented, treat that as a flag that the test isn't testing what it claims to.
- `compute-position-clamp.{ts,test.ts}` and `compute-resize.{ts,test.ts}` deliberately remain — slice [083](./083-deepen-reference-window-placement-commit-and-refit.md) wires `commitMove` / `commitResize` / `refitPlacement` into runtime callers (`ReferenceWindowOverlay.svelte`, `ReferenceWindow.svelte` resize, viewport-resize lifecycle) and removes them then.
- Validation: `bun run check` ✅, `bun run test` ✅ (839 / 839), `cargo test` ✅ (236 / 236). User-visible behaviour identical (gallery cascade, multi-file drop, move / resize / close all unchanged).
