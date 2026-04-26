import { describe, it, expect } from 'vitest';
import { computeThumbnailDimensions } from './thumbnail';

describe('computeThumbnailDimensions', () => {
	it('scales landscape so the longest edge equals the cap', () => {
		const result = computeThumbnailDimensions(1024, 512, 256);

		expect(result).toEqual({ w: 256, h: 128 });
	});

	it('scales portrait so the longest edge equals the cap', () => {
		const result = computeThumbnailDimensions(512, 1024, 256);

		expect(result).toEqual({ w: 128, h: 256 });
	});

	it('keeps a square at the cap when both edges equal it', () => {
		const result = computeThumbnailDimensions(256, 256, 256);

		expect(result).toEqual({ w: 256, h: 256 });
	});

	it('does not upscale when both edges are smaller than the cap', () => {
		const result = computeThumbnailDimensions(64, 32, 256);

		expect(result).toEqual({ w: 64, h: 32 });
	});
});
