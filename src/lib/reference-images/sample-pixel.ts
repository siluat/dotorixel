import type { Color } from '../canvas/color';

export interface DecodedImage {
	readonly width: number;
	readonly height: number;
	readonly data: Uint8ClampedArray;
}

/**
 * Read the RGBA color at `(x, y)` from a row-major RGBA byte buffer.
 *
 * Pure helper for code paths that already have the full pixel buffer
 * available (e.g. tests, or a future cached-decode path that decodes once
 * and samples many times). The async `sampler.ts` boundary skips this
 * indirection by reading a single pixel directly from the canvas.
 *
 * Caller must guarantee `0 <= x < image.width` and `0 <= y < image.height`.
 * No bounds checks; out-of-range reads return undefined channel values.
 */
export function samplePixel(image: DecodedImage, x: number, y: number): Color {
	const i = (y * image.width + x) * 4;
	return {
		r: image.data[i],
		g: image.data[i + 1],
		b: image.data[i + 2],
		a: image.data[i + 3]
	};
}
