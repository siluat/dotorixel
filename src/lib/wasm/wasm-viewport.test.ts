import { describe, it, expect } from 'vitest';
import { WasmViewport } from '$wasm/dotorixel_wasm';

describe('WasmViewport', () => {
	it('creates from constructor', () => {
		const vp = new WasmViewport(16, 1.0, 0.0, 0.0);
		expect(vp.pixel_size).toBe(16);
		expect(vp.zoom).toBe(1.0);
		expect(vp.pan_x).toBe(0.0);
		expect(vp.pan_y).toBe(0.0);
	});

	it('creates for a canvas with default settings', () => {
		const vp = WasmViewport.for_canvas(32, 32);
		expect(vp.pixel_size).toBeGreaterThan(0);
		expect(vp.zoom).toBe(1.0);
		expect(vp.pan_x).toBe(0.0);
		expect(vp.pan_y).toBe(0.0);
	});

	it('computes effective pixel size', () => {
		const vp = new WasmViewport(16, 2.0, 0.0, 0.0);
		expect(vp.effective_pixel_size()).toBe(32.0);
	});

	it('converts screen to canvas coordinates', () => {
		const vp = WasmViewport.for_canvas(32, 32);
		const coords = vp.screen_to_canvas(0, 0);
		expect(coords.x).toBe(0);
		expect(coords.y).toBe(0);
	});

	it('may return negative canvas coordinates for off-canvas screen positions', () => {
		const vp = new WasmViewport(16, 1.0, 32.0, 32.0);
		const coords = vp.screen_to_canvas(0, 0);
		expect(coords.x).toBeLessThan(0);
		expect(coords.y).toBeLessThan(0);
	});

	it('computes display size', () => {
		const vp = new WasmViewport(16, 1.0, 0.0, 0.0);
		const size = vp.display_size(32, 32);
		expect(size.width).toBe(32 * 16);
		expect(size.height).toBe(32 * 16);
	});

	it('zooms at a point', () => {
		const vp = WasmViewport.for_canvas(32, 32);
		const zoomed = vp.zoom_at_point(100, 100, 2.0);
		expect(zoomed.zoom).toBe(2.0);
	});

	it('pans by delta', () => {
		const vp = new WasmViewport(16, 1.0, 0.0, 0.0);
		const panned = vp.pan(10.0, -5.0);
		expect(panned.pan_x).toBe(10.0);
		expect(panned.pan_y).toBe(-5.0);
	});

	it('clamps pan to keep canvas visible', () => {
		const vp = new WasmViewport(16, 1.0, 10000.0, 10000.0);
		const clamped = vp.clamp_pan(32, 32, 512.0, 512.0);
		expect(clamped.pan_x).toBeLessThan(10000.0);
		expect(clamped.pan_y).toBeLessThan(10000.0);
	});

	it('fits canvas to viewport', () => {
		const vp = new WasmViewport(16, 1.0, 100.0, 100.0);
		const fitted = vp.fit_to_viewport(32, 32, 800.0, 600.0);
		expect(fitted.zoom).toBeGreaterThan(0);
	});

	it('exposes zoom utility functions', () => {
		expect(WasmViewport.clamp_zoom(0.1)).toBe(WasmViewport.min_zoom());
		expect(WasmViewport.clamp_zoom(100.0)).toBe(WasmViewport.max_zoom());
		expect(WasmViewport.next_zoom_level(1.0)).toBeGreaterThan(1.0);
		expect(WasmViewport.prev_zoom_level(1.0)).toBeLessThan(1.0);
	});

	it('computes default pixel size', () => {
		const ps = WasmViewport.default_pixel_size(32, 32);
		expect(ps).toBeGreaterThan(0);
	});

	it('exposes zoom level constants', () => {
		const levels = WasmViewport.zoom_levels();
		expect(levels).toBeInstanceOf(Float64Array);
		expect(levels.length).toBeGreaterThan(0);
		expect(levels[0]).toBe(WasmViewport.min_zoom());
		expect(levels[levels.length - 1]).toBe(WasmViewport.max_zoom());
	});
});
