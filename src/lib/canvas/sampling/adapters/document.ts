import type { Document } from '../../canvas-model';
import type { SamplingPort } from '../ports';

/**
 * Adapts a `Document` to the Canvas Sampling Session port. The adapter uses
 * the document's active-layer sampling path: Pixel Layers read document pixels,
 * while Reference Layers sample their placed source image.
 */
export function createDocumentSamplingPort(doc: Document): SamplingPort {
	return {
		width: doc.width,
		height: doc.height,
		get_pixel(x, y) {
			const pixel = doc.try_get_pixel(x, y);
			if (!pixel) return null;
			return { r: pixel.r, g: pixel.g, b: pixel.b, a: pixel.a };
		}
	};
}
