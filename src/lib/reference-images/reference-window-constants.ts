/**
 * Minimum edge length for a reference window, in pixels.
 *
 * Shared by initial placement (`computeInitialPlacement`) and resize math
 * (`computeResize` via `ReferenceWindow`) so the floor that prevents the
 * window from collapsing matches the floor that initial sizing respects.
 */
export const MIN_WINDOW_EDGE = 80;

/**
 * Pixel offset between successive reference windows when staggered.
 *
 * Used both when sequentially opening from the gallery (`computeInitialPlacement`)
 * and when multiple files are dropped on the canvas at once (`+page.svelte`),
 * so the staircase effect is visually consistent regardless of trigger.
 */
export const CASCADE_OFFSET = 24;
