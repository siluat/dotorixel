import { describe, it, expect } from 'vitest';
import { TRANSPARENT, type Color } from '../color.ts';
import {
	createCanvas,
	createCanvasWithColor,
	getPixel,
	setPixel,
	isInsideBounds,
	isValidCanvasDimension,
	resizeCanvas
} from './canvas.ts';

const RED: Color = { r: 255, g: 0, b: 0, a: 255 };
const SEMI_TRANSPARENT_BLUE: Color = { r: 0, g: 0, b: 255, a: 128 };

describe('createCanvas', () => {
	it.each([8, 16, 32])('creates a %dx%d canvas with correct dimensions', (size) => {
		const canvas = createCanvas(size, size);
		expect(canvas.width).toBe(size);
		expect(canvas.height).toBe(size);
	});

	it.each([8, 16, 32])('allocates correct buffer size for %dx%d', (size) => {
		const canvas = createCanvas(size, size);
		expect(canvas.pixels.length).toBe(size * size * 4);
	});

	it('initializes all pixels to transparent', () => {
		const canvas = createCanvas(8, 8);
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				expect(getPixel(canvas, x, y)).toEqual(TRANSPARENT);
			}
		}
	});

	it('creates rectangular canvas', () => {
		const canvas = createCanvas(16, 8);
		expect(canvas.width).toBe(16);
		expect(canvas.height).toBe(8);
		expect(canvas.pixels.length).toBe(16 * 8 * 4);
	});
});

describe('createCanvasWithColor', () => {
	it('fills all pixels with the specified opaque color', () => {
		const canvas = createCanvasWithColor(8, 8, RED);
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				expect(getPixel(canvas, x, y)).toEqual(RED);
			}
		}
	});

	it('fills all pixels with a semi-transparent color', () => {
		const canvas = createCanvasWithColor(8, 8, SEMI_TRANSPARENT_BLUE);
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				expect(getPixel(canvas, x, y)).toEqual(SEMI_TRANSPARENT_BLUE);
			}
		}
	});
});

describe('getPixel / setPixel', () => {
	it('round-trips a color through set and get', () => {
		const canvas = createCanvas(8, 8);
		setPixel(canvas, 3, 4, RED);
		expect(getPixel(canvas, 3, 4)).toEqual(RED);
	});

	it('overwrites an existing pixel', () => {
		const canvas = createCanvasWithColor(8, 8, RED);
		setPixel(canvas, 0, 0, SEMI_TRANSPARENT_BLUE);
		expect(getPixel(canvas, 0, 0)).toEqual(SEMI_TRANSPARENT_BLUE);
	});

	it('does not affect adjacent pixels when setting a pixel', () => {
		const canvas = createCanvas(8, 8);
		setPixel(canvas, 3, 3, RED);

		expect(getPixel(canvas, 2, 3)).toEqual(TRANSPARENT);
		expect(getPixel(canvas, 4, 3)).toEqual(TRANSPARENT);
		expect(getPixel(canvas, 3, 2)).toEqual(TRANSPARENT);
		expect(getPixel(canvas, 3, 4)).toEqual(TRANSPARENT);
	});

	it('accesses boundary pixels correctly', () => {
		const canvas = createCanvas(16, 16);
		setPixel(canvas, 0, 0, RED);
		setPixel(canvas, 15, 15, SEMI_TRANSPARENT_BLUE);

		expect(getPixel(canvas, 0, 0)).toEqual(RED);
		expect(getPixel(canvas, 15, 15)).toEqual(SEMI_TRANSPARENT_BLUE);
	});

	it.each([
		[-1, 0, 'negative x'],
		[0, -1, 'negative y'],
		[8, 0, 'x === width'],
		[0, 8, 'y === height'],
		[1.5, 0, 'non-integer x'],
		[0, 2.7, 'non-integer y']
	])('getPixel throws for out-of-bounds coordinates: %s', (x, y) => {
		const canvas = createCanvas(8, 8);
		expect(() => getPixel(canvas, x, y)).toThrow(RangeError);
	});

	it.each([
		[-1, 0, 'negative x'],
		[0, -1, 'negative y'],
		[8, 0, 'x === width'],
		[0, 8, 'y === height'],
		[1.5, 0, 'non-integer x'],
		[0, 2.7, 'non-integer y']
	])('setPixel throws for out-of-bounds coordinates: %s', (x, y) => {
		const canvas = createCanvas(8, 8);
		expect(() => setPixel(canvas, x, y, RED)).toThrow(RangeError);
	});

	it('includes coordinates, canvas size, and valid range in error message', () => {
		const canvas = createCanvas(16, 16);
		expect(() => getPixel(canvas, 20, 5)).toThrow('(20, 5)');
		expect(() => getPixel(canvas, 20, 5)).toThrow('16x16');
		expect(() => getPixel(canvas, 20, 5)).toThrow('x in [0, 15]');
	});
});

describe('isInsideBounds', () => {
	it('returns true for origin (0, 0)', () => {
		expect(isInsideBounds(createCanvas(8, 8), 0, 0)).toBe(true);
	});

	it('returns true for max valid coordinates', () => {
		expect(isInsideBounds(createCanvas(8, 8), 7, 7)).toBe(true);
	});

	it('returns false for negative coordinates', () => {
		expect(isInsideBounds(createCanvas(8, 8), -1, 0)).toBe(false);
		expect(isInsideBounds(createCanvas(8, 8), 0, -1)).toBe(false);
	});

	it('returns false for coordinates at the boundary', () => {
		expect(isInsideBounds(createCanvas(8, 8), 8, 0)).toBe(false);
		expect(isInsideBounds(createCanvas(8, 8), 0, 8)).toBe(false);
	});

	it('returns false for non-integer coordinates', () => {
		expect(isInsideBounds(createCanvas(8, 8), 1.5, 0)).toBe(false);
		expect(isInsideBounds(createCanvas(8, 8), 0, 3.14)).toBe(false);
	});
});

describe('isValidCanvasDimension', () => {
	it.each([1, 8, 64, 128])('returns true for valid dimension %d', (value) => {
		expect(isValidCanvasDimension(value)).toBe(true);
	});

	it.each([0, -1, 1.5, 129])('returns false for invalid dimension %d', (value) => {
		expect(isValidCanvasDimension(value)).toBe(false);
	});
});

describe('resizeCanvas', () => {
	it('returns identical pixel data for same size', () => {
		const source = createCanvasWithColor(8, 8, RED);
		const result = resizeCanvas(source, 8, 8);
		expect(result.width).toBe(8);
		expect(result.height).toBe(8);
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				expect(getPixel(result, x, y)).toEqual(RED);
			}
		}
	});

	it('preserves existing pixels when expanding', () => {
		const source = createCanvasWithColor(4, 4, RED);
		const result = resizeCanvas(source, 8, 8);
		expect(result.width).toBe(8);
		expect(result.height).toBe(8);
		for (let y = 0; y < 4; y++) {
			for (let x = 0; x < 4; x++) {
				expect(getPixel(result, x, y)).toEqual(RED);
			}
		}
		expect(getPixel(result, 4, 0)).toEqual(TRANSPARENT);
		expect(getPixel(result, 0, 4)).toEqual(TRANSPARENT);
		expect(getPixel(result, 7, 7)).toEqual(TRANSPARENT);
	});

	it('clips pixels when shrinking', () => {
		const source = createCanvasWithColor(8, 8, RED);
		setPixel(source, 0, 0, SEMI_TRANSPARENT_BLUE);
		const result = resizeCanvas(source, 4, 4);
		expect(result.width).toBe(4);
		expect(result.height).toBe(4);
		expect(getPixel(result, 0, 0)).toEqual(SEMI_TRANSPARENT_BLUE);
		expect(getPixel(result, 3, 3)).toEqual(RED);
	});

	it('handles width-only expansion', () => {
		const source = createCanvasWithColor(4, 4, RED);
		const result = resizeCanvas(source, 8, 4);
		expect(result.width).toBe(8);
		expect(result.height).toBe(4);
		expect(getPixel(result, 3, 3)).toEqual(RED);
		expect(getPixel(result, 4, 0)).toEqual(TRANSPARENT);
	});

	it('handles height-only expansion', () => {
		const source = createCanvasWithColor(4, 4, RED);
		const result = resizeCanvas(source, 4, 8);
		expect(result.width).toBe(4);
		expect(result.height).toBe(8);
		expect(getPixel(result, 3, 3)).toEqual(RED);
		expect(getPixel(result, 0, 4)).toEqual(TRANSPARENT);
	});

	it('handles 1x1 canvas', () => {
		const source = createCanvasWithColor(1, 1, RED);
		const result = resizeCanvas(source, 4, 4);
		expect(getPixel(result, 0, 0)).toEqual(RED);
		expect(getPixel(result, 1, 0)).toEqual(TRANSPARENT);
	});

	it('does not mutate source canvas', () => {
		const source = createCanvasWithColor(4, 4, RED);
		resizeCanvas(source, 8, 8);
		expect(source.width).toBe(4);
		expect(source.height).toBe(4);
		expect(getPixel(source, 0, 0)).toEqual(RED);
	});
});
