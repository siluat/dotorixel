import { describe, it, expect } from 'vitest';
import { applyTool, interpolatePixels } from './tool.ts';
import { createCanvas, createCanvasWithColor, getPixel, TRANSPARENT } from './canvas.ts';
import type { Color } from './canvas.ts';

const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const RED: Color = { r: 255, g: 0, b: 0, a: 255 };

describe('applyTool', () => {
	describe('pencil', () => {
		it('applies foreground color to the target pixel', () => {
			const canvas = createCanvas(8);
			applyTool(canvas, 3, 4, 'pencil', RED);
			expect(getPixel(canvas, 3, 4)).toEqual(RED);
		});

		it('overwrites existing pixel color', () => {
			const canvas = createCanvasWithColor(8, BLACK);
			applyTool(canvas, 0, 0, 'pencil', RED);
			expect(getPixel(canvas, 0, 0)).toEqual(RED);
		});

		it('does not affect adjacent pixels', () => {
			const canvas = createCanvas(8);
			applyTool(canvas, 3, 3, 'pencil', RED);
			expect(getPixel(canvas, 2, 3)).toEqual(TRANSPARENT);
			expect(getPixel(canvas, 4, 3)).toEqual(TRANSPARENT);
			expect(getPixel(canvas, 3, 2)).toEqual(TRANSPARENT);
			expect(getPixel(canvas, 3, 4)).toEqual(TRANSPARENT);
		});
	});

	describe('eraser', () => {
		it('sets pixel to TRANSPARENT regardless of foreground color', () => {
			const canvas = createCanvasWithColor(8, BLACK);
			applyTool(canvas, 2, 2, 'eraser', RED);
			expect(getPixel(canvas, 2, 2)).toEqual(TRANSPARENT);
		});
	});

	describe('boundary handling', () => {
		it('returns false for out-of-bounds coordinates', () => {
			const canvas = createCanvas(8);
			expect(applyTool(canvas, -1, 0, 'pencil', BLACK)).toBe(false);
			expect(applyTool(canvas, 0, -1, 'pencil', BLACK)).toBe(false);
			expect(applyTool(canvas, 8, 0, 'pencil', BLACK)).toBe(false);
			expect(applyTool(canvas, 0, 8, 'pencil', BLACK)).toBe(false);
		});

		it('does not throw for out-of-bounds coordinates', () => {
			const canvas = createCanvas(8);
			expect(() => applyTool(canvas, -1, 0, 'pencil', BLACK)).not.toThrow();
		});

		it('does not modify canvas for out-of-bounds coordinates', () => {
			const canvas = createCanvas(8);
			applyTool(canvas, -1, 0, 'pencil', BLACK);
			for (let y = 0; y < 8; y++) {
				for (let x = 0; x < 8; x++) {
					expect(getPixel(canvas, x, y)).toEqual(TRANSPARENT);
				}
			}
		});

		it('returns true for valid coordinates', () => {
			const canvas = createCanvas(8);
			expect(applyTool(canvas, 0, 0, 'pencil', BLACK)).toBe(true);
			expect(applyTool(canvas, 7, 7, 'pencil', BLACK)).toBe(true);
		});
	});
});

describe('interpolatePixels', () => {
	it('returns a single point when start equals end', () => {
		expect(interpolatePixels(3, 5, 3, 5)).toEqual([{ x: 3, y: 5 }]);
	});

	it('returns horizontal line (y fixed)', () => {
		expect(interpolatePixels(1, 2, 5, 2)).toEqual([
			{ x: 1, y: 2 },
			{ x: 2, y: 2 },
			{ x: 3, y: 2 },
			{ x: 4, y: 2 },
			{ x: 5, y: 2 }
		]);
	});

	it('returns vertical line (x fixed)', () => {
		expect(interpolatePixels(3, 0, 3, 3)).toEqual([
			{ x: 3, y: 0 },
			{ x: 3, y: 1 },
			{ x: 3, y: 2 },
			{ x: 3, y: 3 }
		]);
	});

	it('returns 45-degree diagonal', () => {
		expect(interpolatePixels(0, 0, 3, 3)).toEqual([
			{ x: 0, y: 0 },
			{ x: 1, y: 1 },
			{ x: 2, y: 2 },
			{ x: 3, y: 3 }
		]);
	});

	it('returns continuous pixels for a shallow slope', () => {
		const points = interpolatePixels(0, 0, 4, 2);
		expect(points[0]).toEqual({ x: 0, y: 0 });
		expect(points[points.length - 1]).toEqual({ x: 4, y: 2 });
		// Every consecutive pair must be adjacent (no gaps)
		for (let i = 1; i < points.length; i++) {
			const dx = Math.abs(points[i].x - points[i - 1].x);
			const dy = Math.abs(points[i].y - points[i - 1].y);
			expect(dx).toBeLessThanOrEqual(1);
			expect(dy).toBeLessThanOrEqual(1);
		}
	});

	it('returns two points for adjacent pixels', () => {
		expect(interpolatePixels(2, 3, 3, 3)).toEqual([
			{ x: 2, y: 3 },
			{ x: 3, y: 3 }
		]);
	});

	it('handles reverse direction (x1 < x0)', () => {
		const points = interpolatePixels(5, 2, 1, 2);
		expect(points[0]).toEqual({ x: 5, y: 2 });
		expect(points[points.length - 1]).toEqual({ x: 1, y: 2 });
		expect(points).toHaveLength(5);
	});

	it('handles reverse direction (y1 < y0)', () => {
		const points = interpolatePixels(2, 5, 2, 1);
		expect(points[0]).toEqual({ x: 2, y: 5 });
		expect(points[points.length - 1]).toEqual({ x: 2, y: 1 });
		expect(points).toHaveLength(5);
	});
});
