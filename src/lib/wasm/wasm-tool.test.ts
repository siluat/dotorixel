import { describe, it, expect } from 'vitest';
import {
	WasmPixelCanvas,
	WasmColor,
	WasmToolType,
	apply_tool,
	wasm_interpolate_pixels,
} from '$wasm/dotorixel_wasm';

describe('apply_tool', () => {
	it('draws a pixel with pencil', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const red = new WasmColor(255, 0, 0, 255);
		const result = apply_tool(canvas, 3, 4, WasmToolType.Pencil, red);

		expect(result).toBe(true);
		const pixel = canvas.get_pixel(3, 4);
		expect(pixel.r).toBe(255);
		expect(pixel.a).toBe(255);
	});

	it('erases a pixel with eraser', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const red = new WasmColor(255, 0, 0, 255);
		canvas.set_pixel(2, 2, red);

		const result = apply_tool(canvas, 2, 2, WasmToolType.Eraser, red);
		expect(result).toBe(true);

		const pixel = canvas.get_pixel(2, 2);
		expect(pixel.a).toBe(0);
	});

	it('returns false for out-of-bounds coordinates', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const color = new WasmColor(0, 0, 0, 255);
		expect(apply_tool(canvas, -1, 0, WasmToolType.Pencil, color)).toBe(false);
		expect(apply_tool(canvas, 0, 8, WasmToolType.Pencil, color)).toBe(false);
	});
});

describe('wasm_interpolate_pixels', () => {
	it('returns start and end points for a line', () => {
		const result = wasm_interpolate_pixels(0, 0, 3, 0);
		expect(result).toBeInstanceOf(Int32Array);
		expect(result[0]).toBe(0);
		expect(result[1]).toBe(0);
		expect(result[result.length - 2]).toBe(3);
		expect(result[result.length - 1]).toBe(0);
	});

	it('returns a single point when start equals end', () => {
		const result = wasm_interpolate_pixels(5, 5, 5, 5);
		expect(result.length).toBe(2);
		expect(result[0]).toBe(5);
		expect(result[1]).toBe(5);
	});

	it('produces 8-connected path (each step differs by at most 1 in each axis)', () => {
		const result = wasm_interpolate_pixels(0, 0, 4, 3);
		for (let i = 2; i < result.length; i += 2) {
			const dx = Math.abs(result[i] - result[i - 2]);
			const dy = Math.abs(result[i + 1] - result[i - 1]);
			expect(dx).toBeLessThanOrEqual(1);
			expect(dy).toBeLessThanOrEqual(1);
		}
	});
});
