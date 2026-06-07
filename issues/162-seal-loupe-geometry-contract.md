---
title: "Seal the Loupe geometry contract"
status: done
created: 2026-06-07
---

## What to build

Make `loupe-config.ts` the single source of truth for the Loupe's box geometry, so the
rendered box and the totals the position math depends on (`LOUPE_WIDTH`, `LOUPE_HEIGHT`)
can never silently desync.

Today the geometry lives twice. `sampling/loupe-config.ts` holds the TS constants
(`CELL_SIZE_PX`, `GRID_SIZE`, `BORDER_PX`, `CELL_GAP_PX`, `PADDING_PX`, …) that
`computeLoupePosition` uses to place the overlay, while `ui-editor/Loupe.svelte` re-declares
the same numbers as independent CSS literals (`--cell-size: 24px`, `--grid-columns: 9`,
`gap: 1px`, `border: 1px`, …) — the two copies kept in step only by a comment. A desync
makes `computeLoupePosition` position the Loupe against a size it no longer renders at,
caught only by eye.

After this change, `Loupe.svelte` consumes every box-geometry value from `loupe-config.ts`
as a CSS custom property (`style:--cell-size`, …) and the CSS reads them via `var()`. There
is one source; the rendered box and the position math derive from it together.

Scope:

- Web-shell only; no Rust core or Apple changes. The Loupe is web-only.
- Seal the full box contract: cell size, grid columns, cell gap, outer border, inner
  padding, grid–chip gap, and the chip height (decomposed into swatch size + vertical
  padding so `CHIP_HEIGHT_PX` derives instead of being a magic total).
- Loupe `padding` and the grid–chip `gap` move off the shared `--ds-space-3` token onto
  `loupe-config` (value unchanged at 8px, documented as one spacing step) so the whole box
  has one source — a deliberate, documented deviation from the floating-panel token guidance
  for this precision overlay.
- Decorative values that do not feed the box size stay as-is (center-cell rings, swatch
  radius, chip horizontal gap); color/radius/shadow stay on `--ds-*` tokens.

## Acceptance criteria

- `loupe-config.ts` is the only place each box-geometry number appears; `Loupe.svelte`
  re-declares none of them in CSS.
- `CHIP_HEIGHT_PX` is derived from its parts, not a hardcoded total.
- Pixel-preserving: every value identical to before; no visual change.
- A test reconstructs the rendered box from the emitted custom properties and asserts it
  equals `LOUPE_WIDTH` / `LOUPE_HEIGHT`.
- `svelte-check` clean; unit + e2e suites pass; production build OK.

## Blocked by

None — sourced from the architecture review (`/improve-codebase-architecture`, candidate #3);
standalone refactor. Sibling candidate #2 (batch layer metadata) remains an open follow-up.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/sampling/loupe-config.ts` | Single source for all box geometry: exported the previously-private `CELL_GAP_PX`/`GRID_CHIP_GAP_PX`, added `SWATCH_SIZE_PX`/`CHIP_PADDING_Y_PX`, and derived `CHIP_HEIGHT_PX` from them instead of a hardcoded total; doc reframed from "mirror the CSS" to "the CSS consumes these". |
| `src/lib/ui-editor/Loupe.svelte` | Imports the geometry constants and binds them as inline CSS custom properties (`style:--cell-size`, …); CSS consumes them via `var()`. Removed the duplicated literals and the local `--swatch-size`. |
| `src/lib/ui-editor/Loupe.svelte.test.ts` | Wiring regression test: reconstructs the box from the emitted custom properties and asserts it equals `LOUPE_WIDTH`/`LOUPE_HEIGHT` (happy-dom does no layout). |
| `e2e/editor/loupe-geometry.test.ts` | New real-browser guard: measures the rendered loupe `boundingBox()` against the imported `LOUPE_WIDTH`/`LOUPE_HEIGHT`, and asserts on-screen clamping when sampling near the top edge. |

### Key Decisions

- **Full seal over partial.** Drove *every* box-geometry value from `loupe-config.ts`, including `padding`/`grid–chip gap`, which previously used the shared `--ds-space-3` token. Value unchanged (8px) and documented as one spacing step. Trade-off: a deliberate deviation from the floating-panel "padding = token" guidance (§7.2) for this precision overlay, chosen so the whole box has one source and is fully testable. Color/radius/shadow stay on `--ds-*` tokens.
- **Chip height decomposed.** `CHIP_HEIGHT_PX` derives from `SWATCH_SIZE_PX + CHIP_PADDING_Y_PX * 2` rather than a magic `24`, so the chip's contribution to `LOUPE_HEIGHT` can't drift from the rendered swatch/padding.
- **Custom-property pattern** follows the existing `ReferenceLayerPlacementOverlay` precedent (geometry from TS, color from tokens).

### Notes

- Pixel-preserving: every value identical to before; no visual change.
- The unit test verifies the wiring (emitted props ↔ totals); the e2e test is the true "measured box = computed totals" check that fills the happy-dom layout gap.
- Minor consistency: `.chip` horizontal padding moved from an `8px` literal to `var(--ds-space-3)` (free spacing, not box-contract); `--loupe-border` → `--loupe-border-width` for intent.
- Verified: `svelte-check` clean · unit 1358 passed · e2e (loupe-geometry 2 + drawing 10) passed · production build OK.
