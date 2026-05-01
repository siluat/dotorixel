import type { Color } from '../color';

/**
 * The narrow surface the sampling session needs to read pixels.
 *
 * `PixelCanvas` structurally satisfies this interface, so the canvas
 * eyedropper passes a `PixelCanvas` directly with no adapter.
 * Reference-image sampling wraps a decoded RGBA buffer through
 * `createReferenceSamplingPort`. Tests inject an in-memory implementation.
 *
 * Contract: callers guarantee `0 <= x < width && 0 <= y < height` before
 * calling `get_pixel`. Out-of-bounds handling is `sample-grid.ts`'s
 * responsibility — the port itself is bounds-trusting.
 */
export interface SamplingPort {
	readonly width: number;
	readonly height: number;
	get_pixel(x: number, y: number): Color;
}
