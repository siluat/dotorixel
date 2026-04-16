---
title: Color picker loupe — design spec
status: open
created: 2026-04-16
parent: 063-color-picker-loupe.md
---

## What to build

Visual specification for the color picker loupe, captured in a `.pen` file. This deliverable establishes all visual values that downstream implementation slices consume — chrome, dimensions, patterns, typography, animation behavior. It is HITL because design choices require user review and approval before code references them.

See parent PRD §"Visual Design — Deferred to Design Sub-Issue" for the principles that constrain the design.

## Acceptance criteria

- `.pen` file created (or existing one updated) with the loupe component design.
- Final grid size confirmed (PRD initial candidate is 9×9; this slice may revise to 7×7 if exploration shows 9×9 is too dominant at typical viewport sizes).
- Grid cell size in screen pixels specified, with rationale for the chosen value at typical canvas zoom levels.
- Loupe chrome specified: corner radius, border treatment, drop shadow, background fill — using existing design tokens where they cover the case, introducing new tokens only when reuse is justified (per CLAUDE.md "Make values self-documenting").
- Mouse offset distance from pointer specified.
- Touch offset distance from pointer specified (notably larger than mouse to clear finger occlusion).
- Center cell highlight specified: border color (with contrast guarantee against any pixel color underneath) and border thickness.
- Out-of-canvas cell visual specified: hatched pattern (color, line spacing, line thickness).
- Transparent pixel cell visual specified: checkerboard pattern (cell colors, cell size).
- Hex value chip specified: typography (existing tokens preferred), placement relative to grid, foreground / background color.
- "No color" state for hex chip specified (when center cell is over transparent or out-of-canvas).
- Quadrant flip behavior specified: instant repositioning vs animated transition (and if animated, easing + duration).
- All values reviewed and approved by user.

## Blocked by

None — can start immediately.

## Scenarios addressed

This slice does not directly implement any scenario but provides the visual foundation for scenarios 1, 7, 8, 9 in the parent PRD.
