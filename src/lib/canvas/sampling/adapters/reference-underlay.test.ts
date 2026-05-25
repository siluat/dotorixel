import { describe, expect, it } from 'vitest';
import type { ReferenceUnderlay } from '../../renderer';
import {
	createReferenceUnderlaySamplingPort,
	documentToReferenceSourceCoords
} from './reference-underlay';

const reference: ReferenceUnderlay = {
	sourceKey: 'reference',
	sourceRgba: new Uint8Array([
		255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255
	]),
	naturalWidth: 4,
	naturalHeight: 1,
	placement: { x: 2, y: 1, scale: 2 },
	opacity: 1
};

describe('Reference underlay Sampling Port', () => {
	it('reads colors in source-image coordinates', () => {
		const port = createReferenceUnderlaySamplingPort(reference);

		expect(port.width).toBe(4);
		expect(port.height).toBe(1);
		expect(port.get_pixel(2, 0)).toEqual({ r: 0, g: 0, b: 255, a: 255 });
	});

	it('maps document coordinates into source-image coordinates', () => {
		expect(documentToReferenceSourceCoords(reference, { x: 6, y: 1 })).toEqual({ x: 2, y: 0 });
	});

	it('preserves sub-document-pixel precision before flooring to the source pixel', () => {
		expect(documentToReferenceSourceCoords(reference, { x: 5.9, y: 1 })).toEqual({ x: 1, y: 0 });
		expect(documentToReferenceSourceCoords(reference, { x: 6.1, y: 1 })).toEqual({ x: 2, y: 0 });
	});
});
