/**
 * Loupe geometry — single source of truth shared by the position math
 * (`computeLoupePosition`), the session's `position` derivation, the grid
 * extraction (`sampleGrid`), and the visual component (`Loupe.svelte`).
 *
 * Each public constant maps to a CSS rule in `Loupe.svelte`. Change one
 * here AND in the corresponding rule together — the totals (`LOUPE_WIDTH`,
 * `LOUPE_HEIGHT`) re-derive automatically.
 */

/** Cells per side in the sampled grid (also passed to `sampleGrid`). */
export const GRID_SIZE = 9;

/** Pixel size of each grid cell. Mirrors `.cell` width/height. */
export const CELL_SIZE_PX = 24;

/** Inner padding around grid + chip. Mirrors `.loupe` `padding`. */
export const PADDING_PX = 8;

/** Outer border width on the loupe. Mirrors `.loupe` `border` width. */
export const BORDER_PX = 1;

/** Chip row total height: 4px×2 padding + 16px swatch. Mirrors `.chip`. */
export const CHIP_HEIGHT_PX = 24;

const CELL_GAP_PX = 1;
const GRID_CHIP_GAP_PX = 8;
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
