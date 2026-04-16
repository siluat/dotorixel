---
title: Color picker loupe — out-of-canvas + transparent rendering
status: open
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
