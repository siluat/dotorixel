---
title: Color picker loupe — quadrant flip positioning
status: open
created: 2026-04-16
parent: 063-color-picker-loupe.md
---

## What to build

Replaces the fixed-offset positioning from slice 065 with dynamic positioning that auto-flips the loupe to a different quadrant relative to the pointer when the loupe would otherwise be clipped by the viewport edge. The loupe is always fully visible regardless of where the pointer is on the canvas.

A new pure-function module `loupe-position` encapsulates the geometry (which quadrant given pointer position, viewport dimensions, loupe dimensions, and per-input-source offsets). The module is independently unit-testable and table-driven.

Mouse and touch use different offset magnitudes per the design spec — touch offsets are larger to clear finger occlusion.

See parent PRD §"Implementation Decisions" → "Modules — New" → `loupe-position`.

## Acceptance criteria

- `loupe-position.ts` pure function module created.
- Function signature accepts: pointer screen coordinates, viewport width and height, loupe width and height, mouse offset and touch offset values from the design spec, current input source (mouse vs touch).
- Function returns: loupe screen coordinates and the chosen quadrant (one of `tl`, `tr`, `bl`, `br`).
- Default quadrant matches the design spec; loupe flips to a different quadrant when the default would clip outside the viewport.
- `Loupe.svelte` updated to consume `loupe-position` and apply the returned coordinates.
- Mouse vs touch input source is plumbed through the sampling session so the loupe knows which offset to use.
- Vitest unit tests: table-driven across 4 quadrants × 2 input sources × edge proximity cases (near each viewport corner, near each viewport edge, in the center).
- Manual smoke test: dragging Eyedropper near each viewport edge keeps the loupe fully visible.

## Blocked by

- [065 — drag-and-commit eyedropper + basic loupe](065-color-picker-loupe-drag-commit.md)

## Scenarios addressed

- Scenario 7
