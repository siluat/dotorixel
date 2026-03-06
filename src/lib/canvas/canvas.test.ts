import { describe, it, expect } from 'vitest';
import {
	createCanvas,
	createCanvasWithColor,
	getPixel,
	setPixel,
	isInsideBounds,
	TRANSPARENT,
	type CanvasSize,
	type Color
} from './canvas.ts';

const RED: Color = { r: 255, g: 0, b: 0, a: 255 };
const SEMI_TRANSPARENT_BLUE: Color = { r: 0, g: 0, b: 255, a: 128 };

describe('createCanvas', () => {
	it.each([8, 16, 32] as CanvasSize[])('creates a %dx%d canvas with correct dimensions', (size) => {
		const canvas = createCanvas(size);
		expect(canvas.width).toBe(size);
		expect(canvas.height).toBe(size);
	});

	it.each([8, 16, 32] as CanvasSize[])('allocates correct buffer size for %dx%d', (size) => {
		const canvas = createCanvas(size);
		expect(canvas.pixels.length).toBe(size * size * 4);
	});

	it('initializes all pixels to transparent', () => {
		const canvas = createCanvas(8);
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				expect(getPixel(canvas, x, y)).toEqual(TRANSPARENT);
			}
		}
	});
});

describe('createCanvasWithColor', () => {
	it('fills all pixels with the specified opaque color', () => {
		const canvas = createCanvasWithColor(8, RED);
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				expect(getPixel(canvas, x, y)).toEqual(RED);
			}
		}
	});

	it('fills all pixels with a semi-transparent color', () => {
		const canvas = createCanvasWithColor(8, SEMI_TRANSPARENT_BLUE);
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				expect(getPixel(canvas, x, y)).toEqual(SEMI_TRANSPARENT_BLUE);
			}
		}
	});
});

describe('getPixel / setPixel', () => {
	it('round-trips a color through set and get', () => {
		const canvas = createCanvas(8);
		setPixel(canvas, 3, 4, RED);
		expect(getPixel(canvas, 3, 4)).toEqual(RED);
	});

	it('overwrites an existing pixel', () => {
		const canvas = createCanvasWithColor(8, RED);
		setPixel(canvas, 0, 0, SEMI_TRANSPARENT_BLUE);
		expect(getPixel(canvas, 0, 0)).toEqual(SEMI_TRANSPARENT_BLUE);
	});

	it('does not affect adjacent pixels when setting a pixel', () => {
		const canvas = createCanvas(8);
		setPixel(canvas, 3, 3, RED);

		expect(getPixel(canvas, 2, 3)).toEqual(TRANSPARENT);
		expect(getPixel(canvas, 4, 3)).toEqual(TRANSPARENT);
		expect(getPixel(canvas, 3, 2)).toEqual(TRANSPARENT);
		expect(getPixel(canvas, 3, 4)).toEqual(TRANSPARENT);
	});

	it('accesses boundary pixels correctly', () => {
		const canvas = createCanvas(16);
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
		const canvas = createCanvas(8);
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
		const canvas = createCanvas(8);
		expect(() => setPixel(canvas, x, y, RED)).toThrow(RangeError);
	});

	it('includes coordinates and canvas size in error message', () => {
		const canvas = createCanvas(16);
		expect(() => getPixel(canvas, 20, 5)).toThrow('(20, 5)');
		expect(() => getPixel(canvas, 20, 5)).toThrow('16x16');
	});
});

describe('isInsideBounds', () => {
	it('returns true for origin (0, 0)', () => {
		expect(isInsideBounds(createCanvas(8), 0, 0)).toBe(true);
	});

	it('returns true for max valid coordinates', () => {
		expect(isInsideBounds(createCanvas(8), 7, 7)).toBe(true);
	});

	it('returns false for negative coordinates', () => {
		expect(isInsideBounds(createCanvas(8), -1, 0)).toBe(false);
		expect(isInsideBounds(createCanvas(8), 0, -1)).toBe(false);
	});

	it('returns false for coordinates at the boundary', () => {
		expect(isInsideBounds(createCanvas(8), 8, 0)).toBe(false);
		expect(isInsideBounds(createCanvas(8), 0, 8)).toBe(false);
	});

	it('returns false for non-integer coordinates', () => {
		expect(isInsideBounds(createCanvas(8), 1.5, 0)).toBe(false);
		expect(isInsideBounds(createCanvas(8), 0, 3.14)).toBe(false);
	});
});
