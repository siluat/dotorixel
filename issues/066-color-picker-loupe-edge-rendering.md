---
title: Color picker loupe — out-of-canvas + transparent rendering
status: done
created: 2026-04-16
parent: 063-color-picker-loupe.md
---

## What to build

Refines the loupe to honor the two edge-case visual states: cells whose canvas coordinates fall outside the canvas render with a hatched pattern (canvas-absent), and cells over a transparent pixel render with a checkerboard pattern (alpha-zero). Center-cell behavior is also refined: when the center is over transparent or out-of-canvas, the FG/BG swatch does not update during drag, and releasing on such a cell does not commit (consistent with current eyedropper transparent-skip policy).

After this slice, the loupe accurately distinguishes "no canvas here" from "transparent pixel here" both visually and in commit behavior.

See parent PRD §"Implementation Decisions" → "Edge Case Behavior Summary" for the full table.

## Acceptance criteria

- `sample-grid.ts` updated to return `(RGBA | null)[]`; cells whose canvas coordinates are outside `[0, width)` × `[0, height)` return `null`.
- `Loupe.svelte` updated to render `null` cells with the hatched pattern from the design spec.
- `Loupe.svelte` updated to render cells with `a === 0` using the checkerboard pattern from the design spec.
- `sampling-session` updated: when the center pixel is null or transparent, `update` does not change the live preview color; the last valid color is preserved.
- `sampling-session.commit()` does not change FG/BG and does not emit `addRecentColor` when the center pixel is null or transparent at release time.
- Hex value chip is hidden (or shows a "no color" indicator per design spec) when the center cell is null or transparent.
- Vitest unit tests: `sample-grid` covers center at canvas corner (multiple `null` cells), center over transparent, mixed transparent + opaque + null grids.
- Vitest unit tests: `sampling-session` covers commit over transparent (no FG change), commit over null (no FG change), and drag opaque → transparent → opaque before commit (final commit succeeds with the last opaque-released color).
- Component test: `Loupe.svelte` renders correct cell types for a mixed sample (opaque + transparent + null in one grid).
- Playwright E2E: in a canvas with at least one transparent area, activate Eyedropper, drag onto a transparent pixel, release → FG color is unchanged from before the press.

## Blocked by

- [065 — drag-and-commit eyedropper + basic loupe](065-color-picker-loupe-drag-commit.md)

## Scenarios addressed

- Scenario 8
- Scenario 9
- Scenario 10
- Scenario 11

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/sample-grid.ts` | Return type widened to `(Color \| null)[]`. Cells whose canvas coords fall outside `[0, width) × [0, height)` return `null` instead of clamping to the edge pixel, so "no canvas here" is distinguishable from "transparent pixel here" at the type level. |
| `src/lib/canvas/sample-grid.test.ts` | Replaced the edge-clamp test with one asserting `null` for out-of-bounds cells on a 3×3 canvas with unique per-pixel colors. |
| `src/lib/canvas/sampling-session.svelte.ts` | Added `isValidOpaque` type-predicate. `update()` preserves the last valid opaque `centerColor` when the new center is `null` or `a === 0` so the live preview does not flicker mid-drag. `commit()` reads `grid[CENTER_INDEX]` (current center), not the preserved `centerColor` — releasing over null/transparent returns `NO_EFFECTS`. Dropped the internal `targetPixel` field and the WASM-level `is_inside_bounds` guard (redundant with the null-cell check). Guarded `commit()` with `isActive` so callers that reach `end()` without any `draw` (Alt-eyedropper press/release with no motion) no-op cleanly. |
| `src/lib/canvas/sampling-session.svelte.test.ts` | Added 4 new behavior tests: preserve centerColor on null update, preserve on transparent update, refuse commit when drifted onto transparent, refuse commit when drifted out of canvas, and commit the final opaque color when a drag crosses transparent back to opaque. |
| `src/lib/ui-editor/Loupe.svelte` | Dropped the `centerColor` prop — the chip now derives its state from `grid[centerIndex]`. Added `.cell--out-of-canvas` (`null` cells) with a 45° hatch pattern using `--ds-text-tertiary` on `--ds-bg-surface`, and `.cell--transparent` (`a === 0` cells) with a 12px sub-cell `#FFFFFF`/`#E0E0E0` checkerboard matching the canvas renderer. Added `.swatch--out-of-canvas` and `.swatch--transparent` that mirror the corresponding cell patterns at 16px swatch size. Removed the now-obsolete `.swatch--empty` hook. |
| `src/lib/ui-editor/Loupe.svelte.test.ts` | Migrated all tests to the new prop shape (no `centerColor`). Added mixed-grid tests for null / transparent cell classes, swatch-class derivation, and new `makeGridWithCenter` / `makeGridWithNullAt` / `makeGridWithTransparentAt` helpers. |
| `src/lib/canvas/PixelCanvasView.svelte` | Removed the `centerColor` pass-through; Loupe only receives `grid` and `screenPointer` now. |
| `e2e/editor/drawing.test.ts` | Added a Playwright regression: draw color A → switch FG to B → Eyedropper-drag from the A pixel onto transparent → release. FG must equal B (no commit). |

### Key Decisions

- **Cell class naming by state, not visual** (`cell--out-of-canvas`, `cell--transparent` over `cell--hatched`, `cell--checker`). The class survives future visual redesigns because it describes semantics, not appearance.
- **Commit reads `grid[CENTER_INDEX]`, not the preserved `centerColor`.** `centerColor` is "last valid opaque" for live preview continuity; `commit()` needs the *current* release cell. Splitting these meant a focused RED test (drag drifts onto transparent → commit rejects) drove the refactor.
- **Single source of truth for center state in Loupe.** Deriving `centerCell` from `grid[centerIndex]` inside Loupe drops the `centerColor` prop entirely, which removes a stale-prop class of bug at the type level.
- **Checker colors as literals with invariant comment.** `#FFFFFF` / `#E0E0E0` match `CHECKER_LIGHT` / `CHECKER_DARK` in the canvas renderer so the transparency signal is consistent across the app. Comment makes this invariant explicit.
- **`commit()` guarded by `isActive`**, not by a permissive `isValidOpaque(Color | null | undefined)`. The guard names the condition (session never started) at the boundary, rather than smuggling it into a predicate's type — aligns with "fail at the boundary, trust the core".
- **Swatch checker scales via component-scoped `--swatch-size`**; if the swatch grows later the checker sub-cells follow proportionally without a magic-number edit.

### Notes

- `SamplingSession.centerColor` getter is retained on the interface even though no UI consumer reads it after this slice. It is the seam for the next live-FG-during-drag wiring; removing it now would close that door prematurely.
- No new design tokens were introduced. All pattern values resolve to existing `--ds-*` tokens or literals with a documented invariant reason.
- 549 Vitest tests pass (6 new since 065). 8/8 Playwright drawing tests pass. `svelte-check` is clean.
