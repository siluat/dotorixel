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

describe('ViewportOps camera transforms', () => {
	const defaultVd = viewportOps.forCanvas(16, 16);

	it('forCanvas returns ViewportData with expected defaults', () => {
		expect(defaultVd.pixelSize).toBeGreaterThan(0);
		expect(defaultVd.zoom).toBe(1.0);
		expect(defaultVd.panX).toBe(0);
		expect(defaultVd.panY).toBe(0);
		expect(defaultVd.showGrid).toBe(true);
		expect(defaultVd.gridColor).toBe('#cccccc');
	});

	it('screenToCanvas maps origin correctly at default viewport', () => {
		const coords = viewportOps.screenToCanvas(defaultVd, 0, 0);

		expect(coords.x).toBe(0);
		expect(coords.y).toBe(0);
	});

	it('screenToCanvas produces negative coords for off-canvas positions', () => {
		const vd = { ...defaultVd, panX: 32, panY: 32 };
		const coords = viewportOps.screenToCanvas(vd, 0, 0);

		expect(coords.x).toBeLessThan(0);
		expect(coords.y).toBeLessThan(0);
	});

	it('zoomAtPoint changes zoom and adjusts pan', () => {
		const zoomed = viewportOps.zoomAtPoint(defaultVd, 100, 100, 2.0);

		expect(zoomed.zoom).toBe(2.0);
		expect(zoomed.pixelSize).toBe(defaultVd.pixelSize);
	});

	it('zoomAtPoint preserves grid settings', () => {
		const vd = { ...defaultVd, showGrid: false, gridColor: '#aabbcc' };
		const zoomed = viewportOps.zoomAtPoint(vd, 50, 50, 3.0);

		expect(zoomed.showGrid).toBe(false);
		expect(zoomed.gridColor).toBe('#aabbcc');
	});

	it('pan applies delta', () => {
		const panned = viewportOps.pan(defaultVd, 10, -5);

		expect(panned.panX).toBe(10);
		expect(panned.panY).toBe(-5);
	});

	it('pan preserves grid settings', () => {
		const vd = { ...defaultVd, showGrid: false, gridColor: '#112233' };
		const panned = viewportOps.pan(vd, 1, 1);

		expect(panned.showGrid).toBe(false);
		expect(panned.gridColor).toBe('#112233');
	});

	it('clampPan constrains extreme offsets', () => {
		const extreme = { ...defaultVd, panX: 10000, panY: 10000 };
		const clamped = viewportOps.clampPan(extreme, 16, 16, 512, 512);

		expect(clamped.panX).toBeLessThan(10000);
		expect(clamped.panY).toBeLessThan(10000);
	});

	it('clampPan preserves zero pan at default', () => {
		const clamped = viewportOps.clampPan(defaultVd, 16, 16, 512, 512);

		expect(clamped.panX).toBe(0);
		expect(clamped.panY).toBe(0);
	});

	it('fitToViewport produces valid zoom', () => {
		const fitted = viewportOps.fitToViewport(defaultVd, 16, 16, 800, 600, Infinity);

		expect(fitted.zoom).toBeGreaterThan(0);
	});

	it('fitToViewport respects maxZoom', () => {
		const fitted = viewportOps.fitToViewport(defaultVd, 8, 8, 800, 600, 2.0);

		expect(fitted.zoom).toBeLessThanOrEqual(2.0);
	});

	it('effectivePixelSize computes pixelSize * zoom', () => {
		const vd = { ...defaultVd, pixelSize: 16, zoom: 2.0 };

		expect(viewportOps.effectivePixelSize(vd)).toBe(32);
	});

	it('displaySize computes canvas display dimensions', () => {
		const vd = { ...defaultVd, pixelSize: 16, zoom: 1.0 };
		const size = viewportOps.displaySize(vd, 32, 32);

		expect(size.width).toBe(32 * 16);
		expect(size.height).toBe(32 * 16);
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
