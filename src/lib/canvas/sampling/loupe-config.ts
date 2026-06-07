/**
 * Loupe geometry — the single source of truth shared by the position math
 * (`computeLoupePosition`), the session's `position` derivation, the grid
 * extraction (`sampleGrid`), and the visual component (`Loupe.svelte`).
 *
 * `Loupe.svelte` consumes every geometry value below as a CSS custom property
 * (`style:--cell-size`, `style:--loupe-padding`, …) instead of re-declaring it
 * in its stylesheet, so the rendered box and the totals (`LOUPE_WIDTH`,
 * `LOUPE_HEIGHT`) the position math relies on derive from this one place.
 * Change a value here and both the math and the rendered box follow — there is
 * no second CSS copy to keep in sync.
 */

/** Cells per side in the sampled grid (also passed to `sampleGrid`). */
export const GRID_SIZE = 9;

/** Index of the centre cell in the sampled grid — the colour the session commits. */
export const LOUPE_CENTER_INDEX = (GRID_SIZE * GRID_SIZE - 1) / 2;

/** Side length of each grid cell. Drives `--cell-size`. */
export const CELL_SIZE_PX = 24;

/** Gap between adjacent grid cells — the rendered gridlines. Drives `--cell-gap`. */
export const CELL_GAP_PX = 1;

/** Outer border width on the loupe. Drives `--loupe-border`. */
export const BORDER_PX = 1;

/** Inner padding around grid + chip. Drives `--loupe-padding` (one `--ds-space-3` step). */
export const PADDING_PX = 8;

/** Gap between the grid and the hex chip below it. Drives `--grid-chip-gap` (one `--ds-space-3` step). */
export const GRID_CHIP_GAP_PX = 8;

/** Side length of the chip's colour swatch; also the hex text's line-height. Drives `--swatch-size`. */
export const SWATCH_SIZE_PX = 16;

/** Vertical padding above and below the chip's swatch/text row. Drives `--chip-padding-y`. */
export const CHIP_PADDING_Y_PX = 4;

/** Chip row total height (swatch + vertical padding), folded into `LOUPE_HEIGHT`. */
export const CHIP_HEIGHT_PX = SWATCH_SIZE_PX + CHIP_PADDING_Y_PX * 2;

const GRID_PIXELS_PX = CELL_SIZE_PX * GRID_SIZE + CELL_GAP_PX * (GRID_SIZE - 1);

/** Outer (border-box) loupe width in px. */
export const LOUPE_WIDTH = GRID_PIXELS_PX + PADDING_PX * 2 + BORDER_PX * 2;

/** Outer (border-box) loupe height in px. */
export const LOUPE_HEIGHT =
	GRID_PIXELS_PX + GRID_CHIP_GAP_PX + CHIP_HEIGHT_PX + PADDING_PX * 2 + BORDER_PX * 2;

/** Pointer-to-loupe gap for mouse input (applied symmetrically on x and y). */
export const MOUSE_OFFSET = 20;

/** Pointer-to-loupe vertical gap for touch input. */
export const TOUCH_OFFSET = 80;
