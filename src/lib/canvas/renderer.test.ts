import { describe, it, expect } from 'vitest';
import { getDefaultPixelSize, getDisplaySize, createDefaultViewport, screenToCanvas } from './renderer.ts';
import { createCanvas, type CanvasSize } from './canvas.ts';

describe('getDefaultPixelSize', () => {
	it.each([
		[8, 64],
		[16, 32],
		[32, 16]
	] as [CanvasSize, number][])('for canvas size %d, returns %d', (size, expected) => {
		expect(getDefaultPixelSize(size)).toBe(expected);
	});
});

describe('getDisplaySize', () => {
	it('calculates display size from canvas dimensions and pixel size', () => {
		const canvas = createCanvas(16);
		const size = getDisplaySize(canvas, { pixelSize: 32, showGrid: true, gridColor: '#ccc' });
		expect(size).toEqual({ width: 512, height: 512 });
	});

	it('scales correctly with different pixel sizes', () => {
		const canvas = createCanvas(8);
		const size = getDisplaySize(canvas, { pixelSize: 10, showGrid: false, gridColor: '#ccc' });
		expect(size).toEqual({ width: 80, height: 80 });
	});
});

describe('screenToCanvas', () => {
	const viewport = { pixelSize: 32, showGrid: true, gridColor: '#ccc' };

	it('converts origin to canvas coordinate (0, 0)', () => {
		expect(screenToCanvas(0, 0, viewport)).toEqual({ x: 0, y: 0 });
	});

	it('maps coordinates within a pixel to the same canvas coordinate', () => {
		expect(screenToCanvas(1, 1, viewport)).toEqual({ x: 0, y: 0 });
		expect(screenToCanvas(31, 31, viewport)).toEqual({ x: 0, y: 0 });
	});

	it('maps pixel boundary to next canvas coordinate', () => {
		expect(screenToCanvas(32, 0, viewport)).toEqual({ x: 1, y: 0 });
		expect(screenToCanvas(0, 32, viewport)).toEqual({ x: 0, y: 1 });
	});

	it('works with different pixel sizes', () => {
		const smallViewport = { pixelSize: 10, showGrid: false, gridColor: '#ccc' };
		expect(screenToCanvas(25, 15, smallViewport)).toEqual({ x: 2, y: 1 });
	});

	it('floors fractional screen coordinates', () => {
		expect(screenToCanvas(33.7, 65.9, viewport)).toEqual({ x: 1, y: 2 });
	});
});

describe('createDefaultViewport', () => {
	it('creates viewport with correct default pixel size', () => {
		const viewport = createDefaultViewport(16);
		expect(viewport.pixelSize).toBe(32);
	});

	it('enables grid by default', () => {
		const viewport = createDefaultViewport(16);
		expect(viewport.showGrid).toBe(true);
	});

	it.each([8, 16, 32] as CanvasSize[])(
		'produces ~512px display size for canvas size %d',
		(size) => {
			const viewport = createDefaultViewport(size);
			const canvas = createCanvas(size);
			const display = getDisplaySize(canvas, viewport);
			expect(display.width).toBe(512);
			expect(display.height).toBe(512);
		}
	);
});
