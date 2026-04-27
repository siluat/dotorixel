/**
 * Minimum edge length for a reference window, in pixels.
 *
 * Shared by initial placement (`computeInitialPlacement`) and resize math
 * (`computeResize` via `ReferenceWindow`) so the floor that prevents the
 * window from collapsing matches the floor that initial sizing respects.
 */
export const MIN_WINDOW_EDGE = 80;
