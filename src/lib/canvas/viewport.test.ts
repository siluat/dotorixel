import { describe, it, expect } from 'vitest';
import { viewportOps } from './wasm-backend';

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
