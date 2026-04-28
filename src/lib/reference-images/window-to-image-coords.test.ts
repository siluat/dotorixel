import { describe, it, expect } from 'vitest';
import { windowToImageCoords } from './window-to-image-coords';

describe('windowToImageCoords', () => {
	it('maps 1:1 when displayed size equals natural size', () => {
		const result = windowToImageCoords({
			localX: 5,
			localY: 7,
			displayedWidth: 32,
			displayedHeight: 32,
			naturalWidth: 32,
			naturalHeight: 32
		});

		expect(result).toEqual({ x: 5, y: 7 });
	});

	it('scales local coords to natural pixel coords when displayed is larger', () => {
		// 4× upscale on a non-square image: each natural pixel renders as 4×4.
		// localX=10 lands inside natural pixel x=2 (10/4 = 2.5 → floor = 2).
		const result = windowToImageCoords({
			localX: 10,
			localY: 6,
			displayedWidth: 40,
			displayedHeight: 24,
			naturalWidth: 10,
			naturalHeight: 6
		});

		expect(result).toEqual({ x: 2, y: 1 });
	});

	it('clamps to 0 when local coords are slightly negative (sub-pixel drift)', () => {
		const result = windowToImageCoords({
			localX: -0.5,
			localY: -0.25,
			displayedWidth: 200,
			displayedHeight: 100,
			naturalWidth: 16,
			naturalHeight: 8
		});

		expect(result).toEqual({ x: 0, y: 0 });
	});

	it('clamps to (naturalWidth-1, naturalHeight-1) when local coords land exactly on the trailing edge', () => {
		// Browser sub-pixel rounding can produce localX === displayedWidth at the
		// far edge of the image element. Without clamping, floor(...) returns
		// naturalWidth (out of bounds).
		const result = windowToImageCoords({
			localX: 200,
			localY: 100,
			displayedWidth: 200,
			displayedHeight: 100,
			naturalWidth: 16,
			naturalHeight: 8
		});

		expect(result).toEqual({ x: 15, y: 7 });
	});
});
