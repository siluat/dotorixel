import type { ReferenceLayerUnderlay } from '../../reference-layer-underlay';
import type { SamplingPort } from '../ports';

/**
 * Adapts a placed Reference Layer Underlay to source-image sampling. The port's
 * coordinate space is the original image's pixel grid, not the document grid.
 */
export function createReferenceLayerUnderlaySamplingPort(
	reference: ReferenceLayerUnderlay
): SamplingPort {
	return {
		width: reference.naturalWidth,
		height: reference.naturalHeight,
		get_pixel(x, y) {
			const sourceX = Math.trunc(x);
			const sourceY = Math.trunc(y);
			const i = (sourceY * reference.naturalWidth + sourceX) * 4;
			return {
				r: reference.sourceRgba[i],
				g: reference.sourceRgba[i + 1],
				b: reference.sourceRgba[i + 2],
				a: reference.sourceRgba[i + 3]
			};
		}
	};
}

export function createNoReadableSamplingPort(width: number, height: number): SamplingPort {
	return {
		width,
		height,
		get_pixel: () => null
	};
}
