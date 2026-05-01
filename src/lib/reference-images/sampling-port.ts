import type { SamplingPort } from '../canvas/sampling/ports';
import { samplePixel, type DecodedImage } from './sample-pixel';

/**
 * Adapt a decoded reference image to the sampling port interface used by
 * `SamplingSession`. This lets the shared loupe machinery — grid extraction,
 * position computation, viewport clamping — drive a loupe over a reference
 * window without duplicating any of that logic.
 *
 * The port is bounds-trusting: callers (in practice `sample-grid.ts`)
 * guarantee `0 <= x < width && 0 <= y < height` before calling `get_pixel`.
 */
export function createReferenceSamplingPort(image: DecodedImage): SamplingPort {
	return {
		width: image.width,
		height: image.height,
		get_pixel: (x, y) => samplePixel(image, x, y)
	};
}
