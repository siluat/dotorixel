import type { Color } from '../color';

/**
 * The narrow surface the sampling session needs to read pixels.
 *
 * `PixelCanvas` structurally satisfies this interface, so tests and pure
 * canvas helpers can pass a `PixelCanvas` directly with no adapter.
 * Reference-window sampling wraps a decoded RGBA buffer through
 * `createReferenceSamplingPort`. Canvas Sampling Sessions wrap Pixel-active
 * documents through `createDocumentSamplingPort`; Reference-active sessions
 * use a source-image port so the Loupe samples the original image grid instead
 * of the document pixel grid. Tests inject an in-memory implementation.
 *
 * Contract: callers guarantee integer `0 <= x < width && 0 <= y < height`
 * coordinates before calling `get_pixel`. Out-of-bounds and fractional-target
 * handling are `sample-grid.ts`'s
 * responsibility. `null` means "no readable pixel at this in-bounds
 * coordinate", not transparent.
 */
export interface SamplingPort {
	readonly width: number;
	readonly height: number;
	get_pixel(x: number, y: number): Color | null;
}
