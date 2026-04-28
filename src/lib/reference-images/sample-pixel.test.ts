import { describe, it, expect } from 'vitest';
import { samplePixel, type DecodedImage } from './sample-pixel';

function image1x1(r: number, g: number, b: number, a: number): DecodedImage {
	return {
		width: 1,
		height: 1,
		data: new Uint8ClampedArray([r, g, b, a])
	};
}

describe('samplePixel', () => {
	it('returns the RGBA at (0, 0) of a 1×1 image', () => {
		const image = image1x1(100, 200, 50, 255);

		const color = samplePixel(image, 0, 0);

		expect(color).toEqual({ r: 100, g: 200, b: 50, a: 255 });
	});

	it('preserves alpha, including fully transparent pixels', () => {
		// 1×2 image: opaque red at (0,0), fully transparent at (0,1).
		const image: DecodedImage = {
			width: 1,
			height: 2,
			data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0])
		};

		expect(samplePixel(image, 0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
		expect(samplePixel(image, 0, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});

	it('uses row-major indexing — portrait orientation samples the right row', () => {
		// 2×3 portrait: rows = y, columns = x.
		// (0,0)=A (1,0)=B
		// (0,1)=C (1,1)=D
		// (0,2)=E (1,2)=F
		const data = [
			1, 0, 0, 255,
			2, 0, 0, 255,
			0, 1, 0, 255,
			0, 2, 0, 255,
			0, 0, 1, 255,
			0, 0, 2, 255
		];
		const image: DecodedImage = {
			width: 2,
			height: 3,
			data: new Uint8ClampedArray(data)
		};

		expect(samplePixel(image, 1, 2)).toEqual({ r: 0, g: 0, b: 2, a: 255 });
		expect(samplePixel(image, 0, 1)).toEqual({ r: 0, g: 1, b: 0, a: 255 });
	});

	it('samples both top-left (0,0) and bottom-right (w-1, h-1) corners distinctly', () => {
		// 3×2 image: distinct color per pixel so a wrong index is detectable.
		// Layout (x, y):
		//   (0,0)=A  (1,0)=B  (2,0)=C
		//   (0,1)=D  (1,1)=E  (2,1)=F
		const A = [10, 0, 0, 255];
		const B = [20, 0, 0, 255];
		const C = [30, 0, 0, 255];
		const D = [0, 10, 0, 255];
		const E = [0, 20, 0, 255];
		const F = [0, 30, 0, 255];
		const image: DecodedImage = {
			width: 3,
			height: 2,
			data: new Uint8ClampedArray([...A, ...B, ...C, ...D, ...E, ...F])
		};

		expect(samplePixel(image, 0, 0)).toEqual({ r: 10, g: 0, b: 0, a: 255 });
		expect(samplePixel(image, 2, 1)).toEqual({ r: 0, g: 30, b: 0, a: 255 });
	});
});
