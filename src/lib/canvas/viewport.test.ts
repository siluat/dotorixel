import { describe, it, expect } from 'vitest';
import { extractViewportData, restoreViewportState, type ViewportData } from './viewport';
import { viewportFactory, viewportOps } from './wasm-backend';

describe('ViewportData conversion', () => {
	const sampleData: ViewportData = {
		pixelSize: 24,
		zoom: 2.5,
		panX: 42.0,
		panY: -17.0,
		showGrid: false,
		gridColor: '#aabbcc'
	};

	it('round-trips all fields through extract → restore → extract', () => {
		const state = restoreViewportState(sampleData, viewportFactory);
		const result = extractViewportData(state);

		expect(result).toEqual(sampleData);
	});

	it('restoreViewportState produces a valid ViewportState', () => {
		const state = restoreViewportState(sampleData, viewportFactory);

		expect(state.viewport.pixel_size).toBe(24);
		expect(state.viewport.zoom).toBe(2.5);
		expect(state.viewport.pan_x).toBe(42.0);
		expect(state.viewport.pan_y).toBe(-17.0);
		expect(state.showGrid).toBe(false);
		expect(state.gridColor).toBe('#aabbcc');
	});

	it('extractViewportData reads all fields from ViewportState', () => {
		const state = restoreViewportState(
			{
				pixelSize: 32,
				zoom: 1.0,
				panX: 0,
				panY: 0,
				showGrid: true,
				gridColor: '#cccccc'
			},
			viewportFactory
		);
		const data = extractViewportData(state);

		expect(data.pixelSize).toBe(32);
		expect(data.zoom).toBe(1.0);
		expect(data.panX).toBe(0);
		expect(data.panY).toBe(0);
		expect(data.showGrid).toBe(true);
		expect(data.gridColor).toBe('#cccccc');
	});

	it('restoreViewportState works with a mock factory', () => {
		const mockFactory = {
			create: (ps: number, z: number, px: number, py: number) => ({
				pixel_size: ps,
				zoom: z,
				pan_x: px,
				pan_y: py,
				effective_pixel_size: () => Math.round(ps * z),
				screen_to_canvas: () => ({ x: 0, y: 0 }),
				display_size: () => ({ width: 0, height: 0 }),
				zoom_at_point: () => null as never,
				pan: () => null as never,
				clamp_pan: () => null as never,
				fit_to_viewport: () => null as never
			}),
			forCanvas: () => null as never
		};

		const state = restoreViewportState(sampleData, mockFactory);

		expect(state.viewport.pixel_size).toBe(24);
		expect(state.viewport.zoom).toBe(2.5);
		expect(state.showGrid).toBe(false);
	});
});

describe('ViewportOps zoom math', () => {
	it('zoomLevels returns levels in ascending order', () => {
		const levels = viewportOps.zoomLevels();

		expect(levels.length).toBeGreaterThan(0);
		for (let i = 1; i < levels.length; i++) {
			expect(levels[i]).toBeGreaterThan(levels[i - 1]);
		}
	});

	it('zoomLevels contains minZoom and maxZoom', () => {
		const levels = viewportOps.zoomLevels();

		expect(levels[0]).toBe(viewportOps.minZoom);
		expect(levels[levels.length - 1]).toBe(viewportOps.maxZoom);
	});

	it('clampZoom returns value within bounds', () => {
		expect(viewportOps.clampZoom(1.0)).toBe(1.0);
		expect(viewportOps.clampZoom(0.0)).toBe(viewportOps.minZoom);
		expect(viewportOps.clampZoom(100.0)).toBe(viewportOps.maxZoom);
		expect(viewportOps.clampZoom(-1.0)).toBe(viewportOps.minZoom);
	});

	it('clampZoom preserves values within range', () => {
		expect(viewportOps.clampZoom(viewportOps.minZoom)).toBe(viewportOps.minZoom);
		expect(viewportOps.clampZoom(viewportOps.maxZoom)).toBe(viewportOps.maxZoom);
		expect(viewportOps.clampZoom(2.0)).toBe(2.0);
	});

	it('nextZoomLevel steps to next discrete level', () => {
		expect(viewportOps.nextZoomLevel(1.0)).toBe(2.0);
		expect(viewportOps.nextZoomLevel(2.0)).toBe(4.0);
	});

	it('nextZoomLevel clamps at maximum', () => {
		expect(viewportOps.nextZoomLevel(viewportOps.maxZoom)).toBe(viewportOps.maxZoom);
		expect(viewportOps.nextZoomLevel(viewportOps.maxZoom + 10)).toBe(viewportOps.maxZoom);
	});

	it('nextZoomLevel snaps from intermediate value', () => {
		expect(viewportOps.nextZoomLevel(1.5)).toBe(2.0);
		expect(viewportOps.nextZoomLevel(3.0)).toBe(4.0);
	});

	it('prevZoomLevel steps to previous discrete level', () => {
		expect(viewportOps.prevZoomLevel(2.0)).toBe(1.0);
		expect(viewportOps.prevZoomLevel(4.0)).toBe(2.0);
	});

	it('prevZoomLevel clamps at minimum', () => {
		expect(viewportOps.prevZoomLevel(viewportOps.minZoom)).toBe(viewportOps.minZoom);
		expect(viewportOps.prevZoomLevel(0.1)).toBe(viewportOps.minZoom);
	});

	it('prevZoomLevel snaps from intermediate value', () => {
		expect(viewportOps.prevZoomLevel(1.5)).toBe(1.0);
		expect(viewportOps.prevZoomLevel(6.0)).toBe(4.0);
	});

	it('computePinchZoom zooms in with negative deltaY', () => {
		const result = viewportOps.computePinchZoom(1.0, -100);

		expect(result).toBeGreaterThan(1.0);
		expect(result).toBeLessThanOrEqual(viewportOps.maxZoom);
	});

	it('computePinchZoom zooms out with positive deltaY', () => {
		const result = viewportOps.computePinchZoom(1.0, 100);

		expect(result).toBeLessThan(1.0);
		expect(result).toBeGreaterThanOrEqual(viewportOps.minZoom);
	});

	it('computePinchZoom clamps result within bounds', () => {
		const zoomOut = viewportOps.computePinchZoom(viewportOps.minZoom, 10000);
		const zoomIn = viewportOps.computePinchZoom(viewportOps.maxZoom, -10000);

		expect(zoomOut).toBe(viewportOps.minZoom);
		expect(zoomIn).toBe(viewportOps.maxZoom);
	});

	it('defaultPixelSize scales inversely with canvas size', () => {
		const small = viewportOps.defaultPixelSize(8, 8);
		const large = viewportOps.defaultPixelSize(32, 32);

		expect(small).toBeGreaterThan(large);
	});

	it('defaultPixelSize uses larger dimension', () => {
		expect(viewportOps.defaultPixelSize(16, 32)).toBe(viewportOps.defaultPixelSize(32, 16));
	});
});
