import { describe, it, expect } from 'vitest';
import { createReferenceSamplingPort } from './sampling-port';
import type { DecodedImage } from './sample-pixel';

describe('createReferenceSamplingPort', () => {
	it('exposes the decoded image dimensions as port width and height', () => {
		const image: DecodedImage = {
			width: 7,
			height: 4,
			data: new Uint8ClampedArray(7 * 4 * 4)
		};

		const port = createReferenceSamplingPort(image);

		expect(port.width).toBe(7);
		expect(port.height).toBe(4);
	});

	it('reads pixels from the decoded RGBA buffer at the given (x, y)', () => {
		// 2×2 image — distinct color per pixel so a wrong index is detectable.
		// (0,0)=red  (1,0)=green
		// (0,1)=blue (1,1)=transparent black
		const image: DecodedImage = {
			width: 2,
			height: 2,
			data: new Uint8ClampedArray([
				255, 0, 0, 255,
				0, 255, 0, 255,
				0, 0, 255, 255,
				0, 0, 0, 0
			])
		};

		const port = createReferenceSamplingPort(image);

		expect(port.get_pixel(0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
		expect(port.get_pixel(1, 0)).toEqual({ r: 0, g: 255, b: 0, a: 255 });
		expect(port.get_pixel(0, 1)).toEqual({ r: 0, g: 0, b: 255, a: 255 });
		expect(port.get_pixel(1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});
});
