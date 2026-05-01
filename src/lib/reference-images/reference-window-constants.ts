/**
 * Minimum edge length for a reference window, in pixels.
 *
 * Shared by `reference-window-placement` (sizing + resize floor) and the
 * resize math in `ReferenceWindow.svelte` so the floor that prevents the
 * window from collapsing matches the floor that initial sizing respects.
 */
export const MIN_WINDOW_EDGE = 80;

/**
 * Pixel offset between successive reference windows when staggered.
 *
 * Used both when sequentially opening from the gallery (`createPlacement`
 * with a `centered` intent in `reference-window-placement`) and when
 * multiple files are dropped on the canvas at once (`+page.svelte`,
 * applied to the drop point before each `createPlacement` call),
 * so the staircase effect is visually consistent regardless of trigger.
 */
export const CASCADE_OFFSET = 24;
