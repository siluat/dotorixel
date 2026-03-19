import { describe, it, expect } from 'vitest';
import { WasmPixelCanvas, WasmColor } from '$wasm/dotorixel_wasm';

describe('WasmPixelCanvas', () => {
	it('creates a canvas with given dimensions', () => {
		const canvas = new WasmPixelCanvas(16, 16);
		expect(canvas.width).toBe(16);
		expect(canvas.height).toBe(16);
	});

	it('creates a canvas filled with a color', () => {
		const red = new WasmColor(255, 0, 0, 255);
		const canvas = WasmPixelCanvas.with_color(4, 4, red);
		const pixel = canvas.get_pixel(0, 0);
		expect(pixel.r).toBe(255);
		expect(pixel.g).toBe(0);
		expect(pixel.b).toBe(0);
		expect(pixel.a).toBe(255);
	});

	it('returns pixels as Uint8Array with correct length', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const pixels = canvas.pixels();
		expect(pixels).toBeInstanceOf(Uint8Array);
		expect(pixels.length).toBe(8 * 8 * 4);
	});

	it('initializes with transparent pixels', () => {
		const canvas = new WasmPixelCanvas(2, 2);
		const pixels = canvas.pixels();
		expect(pixels.every((v) => v === 0)).toBe(true);
	});

	it('sets and gets a pixel', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const blue = new WasmColor(0, 0, 255, 255);
		canvas.set_pixel(3, 4, blue);

		const pixel = canvas.get_pixel(3, 4);
		expect(pixel.r).toBe(0);
		expect(pixel.g).toBe(0);
		expect(pixel.b).toBe(255);
		expect(pixel.a).toBe(255);
	});

	it('checks bounds correctly', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		expect(canvas.is_inside_bounds(0, 0)).toBe(true);
		expect(canvas.is_inside_bounds(7, 7)).toBe(true);
		expect(canvas.is_inside_bounds(8, 0)).toBe(false);
		expect(canvas.is_inside_bounds(0, 8)).toBe(false);
	});

	it('clears all pixels to transparent', () => {
		const canvas = new WasmPixelCanvas(4, 4);
		const red = new WasmColor(255, 0, 0, 255);
		canvas.set_pixel(0, 0, red);
		canvas.clear();
		const pixel = canvas.get_pixel(0, 0);
		expect(pixel.a).toBe(0);
	});

	it('resizes canvas preserving existing pixels', () => {
		const canvas = new WasmPixelCanvas(4, 4);
		const green = new WasmColor(0, 255, 0, 255);
		canvas.set_pixel(1, 1, green);

		const resized = canvas.resize(8, 8);
		expect(resized.width).toBe(8);
		expect(resized.height).toBe(8);

		const pixel = resized.get_pixel(1, 1);
		expect(pixel.g).toBe(255);
	});

	it('exposes dimension constants', () => {
		expect(WasmPixelCanvas.min_dimension()).toBe(1);
		expect(WasmPixelCanvas.max_dimension()).toBe(128);
		expect(WasmPixelCanvas.is_valid_dimension(32)).toBe(true);
		expect(WasmPixelCanvas.is_valid_dimension(0)).toBe(false);
		expect(WasmPixelCanvas.is_valid_dimension(129)).toBe(false);
	});

	it('returns presets as a typed array', () => {
		const presets = WasmPixelCanvas.presets();
		expect(presets).toBeInstanceOf(Uint32Array);
		expect(Array.from(presets)).toEqual([8, 16, 32, 64]);
	});

	it('throws on invalid dimensions', () => {
		expect(() => new WasmPixelCanvas(0, 10)).toThrow();
		expect(() => new WasmPixelCanvas(10, 200)).toThrow();
	});

	it('throws on out-of-bounds pixel access', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		expect(() => canvas.get_pixel(8, 0)).toThrow();
		expect(() => canvas.set_pixel(0, 8, new WasmColor(0, 0, 0, 255))).toThrow();
	});
});
