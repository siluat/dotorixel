import { describe, it, expect } from 'vitest';
import {
	getDefaultPixelSize,
	getDisplaySize,
	createDefaultViewport,
	screenToCanvas,
	effectivePixelSize,
	zoomAtPoint,
	pan,
	clampPan,
	fitToViewport,
	nextZoomLevel,
	prevZoomLevel,
	clampZoom,
	computePinchZoom,
	MIN_VISIBLE_MARGIN,
	MIN_ZOOM,
	MAX_ZOOM
} from './viewport.ts';
import { createCanvas } from './canvas.legacy.ts';
import type { ViewportConfig } from './viewport.ts';

function makeViewport(overrides: Partial<ViewportConfig> = {}): ViewportConfig {
	return {
		pixelSize: 32,
		showGrid: true,
		gridColor: '#ccc',
		zoom: 1,
		panX: 0,
		panY: 0,
		...overrides
	};
}

describe('getDefaultPixelSize', () => {
	it.each([
		[8, 64],
		[16, 32],
		[32, 16]
	])('for canvas size %d, returns %d', (size, expected) => {
		expect(getDefaultPixelSize(size, size)).toBe(expected);
	});

	it('uses the larger dimension for rectangular canvases', () => {
		expect(getDefaultPixelSize(16, 32)).toBe(16);
		expect(getDefaultPixelSize(32, 16)).toBe(16);
	});
});

describe('getDisplaySize', () => {
	it('calculates display size from canvas dimensions and pixel size', () => {
		const canvas = createCanvas(16, 16);
		const size = getDisplaySize(canvas, makeViewport());
		expect(size).toEqual({ width: 512, height: 512 });
	});

	it('scales correctly with different pixel sizes', () => {
		const canvas = createCanvas(8, 8);
		const size = getDisplaySize(canvas, makeViewport({ pixelSize: 10, showGrid: false }));
		expect(size).toEqual({ width: 80, height: 80 });
	});

	it('accounts for zoom in display size', () => {
		const canvas = createCanvas(16, 16);
		const size = getDisplaySize(canvas, makeViewport({ zoom: 2 }));
		expect(size).toEqual({ width: 1024, height: 1024 });
	});
});

describe('effectivePixelSize', () => {
	it('returns pixelSize * zoom', () => {
		expect(effectivePixelSize(makeViewport({ pixelSize: 32, zoom: 2 }))).toBe(64);
	});

	it('handles fractional zoom', () => {
		expect(effectivePixelSize(makeViewport({ pixelSize: 32, zoom: 0.5 }))).toBe(16);
	});

	it('rounds to integer for continuous zoom values', () => {
		// 32 * 1.284 = 41.088 → 41
		expect(effectivePixelSize(makeViewport({ pixelSize: 32, zoom: 1.284 }))).toBe(41);
		// 32 * 1.3 = 41.6 → 42
		expect(effectivePixelSize(makeViewport({ pixelSize: 32, zoom: 1.3 }))).toBe(42);
	});
});

describe('screenToCanvas', () => {
	const viewport = makeViewport();

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
		const smallViewport = makeViewport({ pixelSize: 10, showGrid: false });
		expect(screenToCanvas(25, 15, smallViewport)).toEqual({ x: 2, y: 1 });
	});

	it('floors fractional screen coordinates', () => {
		expect(screenToCanvas(33.7, 65.9, viewport)).toEqual({ x: 1, y: 2 });
	});

	it('accounts for zoom', () => {
		const zoomed = makeViewport({ pixelSize: 32, zoom: 2 });
		// effectivePixelSize = 64, so screen 64 → canvas 1
		expect(screenToCanvas(64, 0, zoomed)).toEqual({ x: 1, y: 0 });
		expect(screenToCanvas(63, 0, zoomed)).toEqual({ x: 0, y: 0 });
	});

	it('accounts for pan offset', () => {
		const panned = makeViewport({ pixelSize: 32, panX: 100, panY: 50 });
		// (100 - 100) / 32 = 0, (50 - 50) / 32 = 0
		expect(screenToCanvas(100, 50, panned)).toEqual({ x: 0, y: 0 });
		// (132 - 100) / 32 = 1
		expect(screenToCanvas(132, 50, panned)).toEqual({ x: 1, y: 0 });
	});

	it('accounts for zoom and pan combined', () => {
		const vp = makeViewport({ pixelSize: 32, zoom: 2, panX: 50, panY: 50 });
		// eps = 64, (50 - 50) / 64 = 0
		expect(screenToCanvas(50, 50, vp)).toEqual({ x: 0, y: 0 });
		// (114 - 50) / 64 = 1
		expect(screenToCanvas(114, 50, vp)).toEqual({ x: 1, y: 0 });
	});
});

describe('createDefaultViewport', () => {
	it('creates viewport with correct default pixel size', () => {
		const viewport = createDefaultViewport(16, 16);
		expect(viewport.pixelSize).toBe(32);
	});

	it('enables grid by default', () => {
		const viewport = createDefaultViewport(16, 16);
		expect(viewport.showGrid).toBe(true);
	});

	it('initializes zoom and pan defaults', () => {
		const viewport = createDefaultViewport(16, 16);
		expect(viewport.zoom).toBe(1);
		expect(viewport.panX).toBe(0);
		expect(viewport.panY).toBe(0);
	});

	it.each([8, 16, 32])(
		'produces ~512px display size for canvas size %d',
		(size) => {
			const viewport = createDefaultViewport(size, size);
			const canvas = createCanvas(size, size);
			const display = getDisplaySize(canvas, viewport);
			expect(display.width).toBe(512);
			expect(display.height).toBe(512);
		}
	);

	it('uses larger dimension for pixel size with rectangular canvas', () => {
		const viewport = createDefaultViewport(32, 64);
		expect(viewport.pixelSize).toBe(8);
	});
});

describe('zoomAtPoint', () => {
	it('preserves canvas coordinate under cursor after zoom', () => {
		const viewport = makeViewport({ pixelSize: 32, zoom: 1, panX: 0, panY: 0 });
		const screenX = 160;
		const screenY = 96;

		const before = screenToCanvas(screenX, screenY, viewport);
		const zoomed = zoomAtPoint(viewport, screenX, screenY, 2);
		const after = screenToCanvas(screenX, screenY, zoomed);

		expect(after).toEqual(before);
	});

	it('updates zoom level', () => {
		const viewport = makeViewport({ zoom: 1 });
		const result = zoomAtPoint(viewport, 100, 100, 4);
		expect(result.zoom).toBe(4);
	});

	it('preserves other viewport properties', () => {
		const viewport = makeViewport({ showGrid: false, gridColor: '#000' });
		const result = zoomAtPoint(viewport, 0, 0, 2);
		expect(result.showGrid).toBe(false);
		expect(result.gridColor).toBe('#000');
		expect(result.pixelSize).toBe(32);
	});
});

describe('pan', () => {
	it('applies delta to panX and panY', () => {
		const viewport = makeViewport({ panX: 10, panY: 20 });
		const result = pan(viewport, 5, -10);
		expect(result.panX).toBe(15);
		expect(result.panY).toBe(10);
	});

	it('preserves other viewport properties', () => {
		const viewport = makeViewport({ zoom: 2, showGrid: false });
		const result = pan(viewport, 100, 200);
		expect(result.zoom).toBe(2);
		expect(result.showGrid).toBe(false);
		expect(result.pixelSize).toBe(32);
	});
});

describe('clampPan', () => {
	const canvas16 = createCanvas(16, 16);
	const viewportSize = { width: 800, height: 600 };

	// --- Canvas fits inside viewport (containment mode) ---
	// pixelSize=32, zoom=1 → eps=32, canvasDisplay=512×512
	// Both axes fit (512 < 800, 512 < 600)
	// X bounds: 0 ≤ panX ≤ 800-512 = 288
	// Y bounds: 0 ≤ panY ≤ 600-512 = 88

	it('returns viewport unchanged when pan is within bounds', () => {
		const vp = makeViewport({ panX: 100, panY: 50 });
		const result = clampPan(vp, canvas16, viewportSize);
		expect(result).toBe(vp);
	});

	it('clamps negative panX to 0 when canvas fits', () => {
		const vp = makeViewport({ panX: -50, panY: 0 });
		const result = clampPan(vp, canvas16, viewportSize);
		expect(result.panX).toBe(0);
		expect(result.panY).toBe(0);
	});

	it('clamps panX to keep canvas right edge inside viewport', () => {
		const vp = makeViewport({ panX: 400, panY: 0 });
		const result = clampPan(vp, canvas16, viewportSize);
		expect(result.panX).toBe(288);
		expect(result.panY).toBe(0);
	});

	it('clamps negative panY to 0 when canvas fits', () => {
		const vp = makeViewport({ panX: 0, panY: -10 });
		const result = clampPan(vp, canvas16, viewportSize);
		expect(result.panX).toBe(0);
		expect(result.panY).toBe(0);
	});

	it('clamps panY to keep canvas bottom edge inside viewport', () => {
		const vp = makeViewport({ panX: 0, panY: 200 });
		const result = clampPan(vp, canvas16, viewportSize);
		expect(result.panX).toBe(0);
		expect(result.panY).toBe(88);
	});

	it('clamps both axes simultaneously', () => {
		const vp = makeViewport({ panX: -999, panY: 999 });
		const result = clampPan(vp, canvas16, viewportSize);
		expect(result.panX).toBe(0);
		expect(result.panY).toBe(88);
	});

	// --- Canvas overflows viewport (margin mode) ---
	// 8×8, pixelSize=64, zoom=16 → eps=1024, canvasDisplay=8192×8192
	// margin = max(1024, 16) = 1024
	// X: minPanX = 1024 - 8192 = -7168, maxPanX = 800 - 1024 = -224
	// Y: minPanY = 1024 - 8192 = -7168, maxPanY = 600 - 1024 = -424

	it('uses margin-based clamping when canvas overflows viewport', () => {
		const canvas8 = createCanvas(8, 8);
		const vp = makeViewport({ pixelSize: 64, zoom: 16, panX: 0, panY: 0 });
		const result = clampPan(vp, canvas8, viewportSize);
		expect(result.panX).toBe(-224);
		expect(result.panY).toBe(-424);
	});

	it('clamps to min bound when canvas overflows and panned too far', () => {
		const canvas8 = createCanvas(8, 8);
		const vp = makeViewport({ pixelSize: 64, zoom: 16, panX: -9999, panY: -9999 });
		const result = clampPan(vp, canvas8, viewportSize);
		expect(result.panX).toBe(-7168);
		expect(result.panY).toBe(-7168);
	});

	// --- Mixed axes: one fits, the other overflows ---

	it('applies containment on fitting axis and margin on overflowing axis', () => {
		// 64×8 canvas, pixelSize=16, zoom=1 → eps=16
		// X: canvasDisplay = 64×16 = 1024 > 800 → margin mode
		//    margin = max(16, 16) = 16, minPanX = 16-1024 = -1008, maxPanX = 800-16 = 784
		// Y: canvasDisplay = 8×16 = 128 ≤ 600 → containment
		//    minPanY = 0, maxPanY = 600-128 = 472
		const wideCanvas = createCanvas(64, 8);
		const vp = makeViewport({ pixelSize: 16, zoom: 1, panX: -2000, panY: -50 });
		const result = clampPan(vp, wideCanvas, viewportSize);
		expect(result.panX).toBe(-1008);
		expect(result.panY).toBe(0);
	});

	// --- Exact boundary: canvas equals viewport ---

	it('locks pan to 0 when canvas exactly equals viewport size', () => {
		// pixelSize=50, zoom=1 → eps=50, canvasDisplay = 16×50 = 800 (=== viewportWidth)
		// 800 <= 800 → containment: minPanX = 0, maxPanX = 800-800 = 0
		const vp = makeViewport({ pixelSize: 50, zoom: 1, panX: 100, panY: 0 });
		const result = clampPan(vp, canvas16, viewportSize);
		expect(result.panX).toBe(0);
	});

	// --- Low zoom: canvas fits, fully contained ---

	it('keeps small canvas fully inside viewport at low zoom', () => {
		// pixelSize=32, zoom=0.25 → eps=8, canvasDisplay=128×128
		// Fits inside viewport → containment: 0 ≤ panX ≤ 672, 0 ≤ panY ≤ 472
		const vp = makeViewport({ pixelSize: 32, zoom: 0.25, panX: -200, panY: 0 });
		const result = clampPan(vp, canvas16, viewportSize);
		expect(result.panX).toBe(0);
		expect(result.panY).toBe(0);
	});

	it('preserves non-pan properties', () => {
		const vp = makeViewport({
			pixelSize: 32,
			showGrid: false,
			gridColor: '#ff0000',
			zoom: 2,
			panX: -9999,
			panY: -9999
		});
		const result = clampPan(vp, canvas16, viewportSize);
		expect(result.pixelSize).toBe(32);
		expect(result.showGrid).toBe(false);
		expect(result.gridColor).toBe('#ff0000');
		expect(result.zoom).toBe(2);
	});
});

describe('fitToViewport', () => {
	it('centers canvas in viewport', () => {
		const viewport = makeViewport({ pixelSize: 32 });
		const canvas = createCanvas(16, 16);
		const result = fitToViewport(viewport, canvas, { width: 800, height: 600 });

		// fitToViewport uses rounded scaledPixel for centering
		const eps = effectivePixelSize(result);
		const displayWidth = 16 * eps;
		const displayHeight = 16 * eps;

		// Canvas should be centered
		expect(result.panX).toBeCloseTo((800 - displayWidth) / 2);
		expect(result.panY).toBeCloseTo((600 - displayHeight) / 2);
	});

	it('fits canvas within viewport bounds', () => {
		const viewport = makeViewport({ pixelSize: 32 });
		const canvas = createCanvas(16, 16);
		const viewportSize = { width: 400, height: 300 };
		const result = fitToViewport(viewport, canvas, viewportSize);

		const eps = 32 * result.zoom;
		expect(16 * eps).toBeLessThanOrEqual(viewportSize.width);
		expect(16 * eps).toBeLessThanOrEqual(viewportSize.height);
	});
});

describe('nextZoomLevel', () => {
	it('returns next level in sequence', () => {
		expect(nextZoomLevel(1)).toBe(2);
		expect(nextZoomLevel(2)).toBe(4);
	});

	it('clamps at maximum', () => {
		expect(nextZoomLevel(16)).toBe(16);
		expect(nextZoomLevel(20)).toBe(16);
	});

	it('snaps to next discrete level from intermediate value', () => {
		expect(nextZoomLevel(1.5)).toBe(2);
		expect(nextZoomLevel(3)).toBe(4);
	});
});

describe('prevZoomLevel', () => {
	it('returns previous level in sequence', () => {
		expect(prevZoomLevel(2)).toBe(1);
		expect(prevZoomLevel(4)).toBe(2);
	});

	it('clamps at minimum', () => {
		expect(prevZoomLevel(0.25)).toBe(0.25);
		expect(prevZoomLevel(0.1)).toBe(0.25);
	});

	it('snaps to previous discrete level from intermediate value', () => {
		expect(prevZoomLevel(1.5)).toBe(1);
		expect(prevZoomLevel(3)).toBe(2);
	});
});

describe('clampZoom', () => {
	it('returns value unchanged when within range', () => {
		expect(clampZoom(1)).toBe(1);
		expect(clampZoom(4)).toBe(4);
	});

	it('clamps to MIN_ZOOM when below range', () => {
		expect(clampZoom(0.01)).toBe(MIN_ZOOM);
		expect(clampZoom(-1)).toBe(MIN_ZOOM);
	});

	it('clamps to MAX_ZOOM when above range', () => {
		expect(clampZoom(100)).toBe(MAX_ZOOM);
		expect(clampZoom(32)).toBe(MAX_ZOOM);
	});
});

describe('computePinchZoom', () => {
	it('zooms in for negative deltaY', () => {
		expect(computePinchZoom(1, -100)).toBeGreaterThan(1);
	});

	it('zooms out for positive deltaY', () => {
		expect(computePinchZoom(1, 100)).toBeLessThan(1);
	});

	it('returns current zoom when deltaY is 0', () => {
		expect(computePinchZoom(4, 0)).toBe(4);
	});

	it('clamps result to MIN_ZOOM', () => {
		expect(computePinchZoom(MIN_ZOOM, 10000)).toBe(MIN_ZOOM);
	});

	it('clamps result to MAX_ZOOM', () => {
		expect(computePinchZoom(MAX_ZOOM, -10000)).toBe(MAX_ZOOM);
	});
});
