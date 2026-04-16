---
title: Color picker loupe — design spec
status: done
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

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | Added "Color Picker Loupe — Design Spec" master frame with 8 sections: header, Anatomy, Cell Types, Hex chip states, Positioning & offsets, Quadrant flip, Design tokens (16-row table), Dark mode variant. |

### Key Decisions

- **Grid size: 9×9** (kept initial candidate; 7×7 was evaluated during interview but 9×9 reads comfortably at the chosen cell size).
- **Grid cell size: 24×24px** (216px grid + 1px gridlines = 224×224 total). Chosen so the full 9×9 grid fits comfortably in the editor viewport at typical zoom levels while still showing enough surrounding context for the sampling decision.
- **Chrome: `--ds-radius-md` (12px), `--ds-space-3` (8px) padding, `--ds-shadow-md`, `--ds-bg-elevated` fill, `--ds-border` 1px** — reuses existing tokens, zero new tokens introduced.
- **Center highlight: 2px white inner ring + 2px black outer ring**, extending 4px outside the center cell. Both literals (not tokens) — the contrast guarantee against any pixel color underneath is the design invariant, so these are intentionally theme-invariant.
- **Out-of-canvas: hatched 2px `--ds-text-tertiary` lines at 6px perpendicular spacing, 45°** on `--ds-bg-surface`. Honest about "no pixel exists here" while staying visually distinct from the checker pattern.
- **Transparent: #FFFFFF + #E0E0E0 checkerboard at 12px sub-cells** (literals, matches `CHECKER_LIGHT` / `CHECKER_DARK` constants in [renderer.ts](src/lib/canvas/renderer.ts) — preserves the conventional transparency signal used across the canvas).
- **Hex chip: `GalmuriMono11` at 11px**, 16×16 swatch, 6px corner radius, white bg with subtle border. Positioned 8px below grid, centered horizontally.
- **"No color" state: em-dash "—"** in `--ds-text-tertiary` with a swatch that mirrors the center cell's pattern (checker or hatch) to disambiguate transparent vs out-of-canvas origins.
- **Mouse offset: 20px** (small — cursor is small). **Touch offset: 80px vertical, centered horizontally** (significantly larger to clear finger occlusion).
- **Quadrant flip: instant snap, no animation.** Animated transitions would chase the pointer awkwardly; snap matches the default-to-upper-right placement heuristic.
- **Rendered dark mode variant** with theme-aware vs theme-invariant token breakdown to make the cross-theme behavior explicit to implementors.

### Notes

- All 12 acceptance criteria from the issue file are covered. No new design tokens were introduced — every value either resolves to an existing `--ds-*` token or is a literal with a documented invariant reason (center ring contrast; checker parity with canvas renderer).
- `.pen` is the single source of truth for visual values. Downstream implementation issues (065 drag-and-commit eyedropper + basic loupe, 066 out-of-canvas + transparent rendering, 067 quadrant flip positioning, 068 long-press touch entry) should read their specific values from this spec file rather than re-deriving them.
- During design, confirmed that Pencil's `rotation: 45°` renders as `/` direction (pivoting around the TL corner), which is what the OoC hatch uses. Implementation in CSS can use either `\` or `/` — the spec direction is a stylistic choice not a semantic one.
