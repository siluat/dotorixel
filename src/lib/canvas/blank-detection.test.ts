import { describe, it, expect } from 'vitest';
import { isBlankCanvas } from './blank-detection';

describe('isBlankCanvas', () => {
	it('returns true when all pixels are transparent (all bytes zero)', () => {
		const pixels = new Uint8Array(16 * 16 * 4); // 16×16, all zeros

		expect(isBlankCanvas(pixels)).toBe(true);
	});

	it('returns false when any pixel has non-zero data', () => {
		const pixels = new Uint8Array(16 * 16 * 4);
		// Draw one opaque red pixel at (3, 5)
		const offset = (5 * 16 + 3) * 4;
		pixels[offset] = 255;     // R
		pixels[offset + 3] = 255; // A

		expect(isBlankCanvas(pixels)).toBe(false);
	});

	it('handles 1×1 blank canvas', () => {
		const pixels = new Uint8Array(4); // single transparent pixel

		expect(isBlankCanvas(pixels)).toBe(true);
	});

	it('handles 1×1 non-blank canvas', () => {
		const pixels = new Uint8Array([0, 0, 0, 255]); // opaque black

		expect(isBlankCanvas(pixels)).toBe(false);
	});
});
