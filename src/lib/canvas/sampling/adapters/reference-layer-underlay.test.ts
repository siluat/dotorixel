import { describe, expect, it } from 'vitest';
import {
	referenceLayerUnderlaySourceCoords,
	type ReferenceLayerUnderlay
} from '../../reference-layer-underlay';
import { createReferenceLayerUnderlaySamplingPort } from './reference-layer-underlay';

const reference: ReferenceLayerUnderlay = {
	sourceKey: 'reference',
	sourceRgba: new Uint8Array([
		255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255
	]),
	naturalWidth: 4,
	naturalHeight: 1,
	placement: { x: 2, y: 1, scale: 2, rotation: 0 },
	projectedBounds: { minX: 2, minY: 1, maxX: 10, maxY: 3 },
	opacity: 1
};

describe('Reference Layer Underlay Sampling Port', () => {
	it('reads colors in source-image coordinates', () => {
		const port = createReferenceLayerUnderlaySamplingPort(reference);

		expect(port.width).toBe(4);
		expect(port.height).toBe(1);
		expect(port.get_pixel(2, 0)).toEqual({ r: 0, g: 0, b: 255, a: 255 });
	});

	it('maps document coordinates into source-image coordinates', () => {
		expect(referenceLayerUnderlaySourceCoords(reference, { x: 6, y: 1 })).toEqual({ x: 2, y: 0 });
	});

	it('preserves sub-document-pixel precision before flooring to the source pixel', () => {
		expect(referenceLayerUnderlaySourceCoords(reference, { x: 5.9, y: 1 })).toEqual({
			x: 1,
			y: 0
		});
		expect(referenceLayerUnderlaySourceCoords(reference, { x: 6.1, y: 1 })).toEqual({
			x: 2,
			y: 0
		});
	});
});
