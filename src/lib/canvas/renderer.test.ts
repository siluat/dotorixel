import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearReferenceRasterCache, renderPixelCanvas } from './renderer';
import type { ReferenceLayerUnderlay } from './reference-layer-underlay';
import type { RenderableCanvas } from './renderer';
import type { ViewportData, ViewportSize } from './viewport';

class FakeImageData {
	constructor(
		readonly data: Uint8ClampedArray,
		readonly width: number,
		readonly height: number
	) {}
}

class FakeOffscreenCanvas {
	static instances: FakeOffscreenCanvas[] = [];

	readonly putImageData = vi.fn();

	constructor(
		readonly width: number,
		readonly height: number
	) {
		FakeOffscreenCanvas.instances.push(this);
	}

	getContext(type: '2d') {
		expect(type).toBe('2d');
		return { putImageData: this.putImageData };
	}
}

afterEach(() => {
	clearReferenceRasterCache();
	FakeOffscreenCanvas.instances = [];
	vi.unstubAllGlobals();
});

function createContext() {
	const calls: unknown[][] = [];
	let alpha = 1;
	const ctx = {
		clearRect: vi.fn(),
		save: vi.fn(() => calls.push(['save'])),
		restore: vi.fn(() => calls.push(['restore'])),
		translate: vi.fn((x: number, y: number) => calls.push(['translate', x, y])),
		fillRect: vi.fn(),
		beginPath: vi.fn(),
		rect: vi.fn((x: number, y: number, width: number, height: number) =>
			calls.push(['rect', x, y, width, height])
		),
		clip: vi.fn(() => calls.push(['clip'])),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
		drawImage: vi.fn((...args: unknown[]) => calls.push(['drawImage', ...args])),
		set fillStyle(_value: string) {},
		set strokeStyle(_value: string) {},
		set lineWidth(_value: number) {},
		set imageSmoothingEnabled(_value: boolean) {},
		get globalAlpha() {
			return alpha;
		},
		set globalAlpha(value: number) {
			alpha = value;
			calls.push(['globalAlpha', value]);
		},
		calls
	};
	return ctx;
}

describe('renderPixelCanvas', () => {
	it('draws a Reference underlay from its original source before the Pixel composite', () => {
		vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
		vi.stubGlobal('ImageData', FakeImageData);

		const canvas: RenderableCanvas = {
			width: 4,
			height: 4,
			pixels: () => new Uint8Array(4 * 4 * 4)
		};
		const reference: ReferenceLayerUnderlay = {
			sourceKey: 'reference-layer-underlay-order',
			sourceRgba: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
			naturalWidth: 2,
			naturalHeight: 1,
			placement: { x: 0.5, y: 1, scale: 2 },
			projectedBounds: { minX: 0.5, minY: 1, maxX: 4.5, maxY: 3 },
			opacity: 0.5
		};
		const viewport: ViewportData = {
			pixelSize: 10,
			zoom: 1,
			panX: 3.2,
			panY: 4.6,
			showGrid: false,
			gridColor: '#000000',
			showOnionSkin: false
		};
		const viewportSize: ViewportSize = { width: 100, height: 100 };
		const ctx = createContext();

		renderPixelCanvas(ctx as unknown as CanvasRenderingContext2D, canvas, viewport, viewportSize, reference);

		const drawCalls = ctx.calls.filter((call) => call[0] === 'drawImage');
		expect(drawCalls).toHaveLength(2);
		expect((drawCalls[0][1] as FakeOffscreenCanvas).width).toBe(2);
		expect((drawCalls[1][1] as FakeOffscreenCanvas).width).toBe(4);
		expect(drawCalls[0].slice(2)).toEqual([0, 0, 2, 1, 5, 10, 40, 20]);
		expect(ctx.calls).toContainEqual(['translate', 3, 5]);
		expect(ctx.calls).toContainEqual(['rect', 0, 0, 40, 40]);
		expect(ctx.calls).toContainEqual(['clip']);
		expect(ctx.calls).toContainEqual(['globalAlpha', 0.5]);
		expect(ctx.calls).toContainEqual(['globalAlpha', 1]);
	});

	it('reuses the rasterized Reference source when placement changes', () => {
		vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
		vi.stubGlobal('ImageData', FakeImageData);

		const canvas: RenderableCanvas = {
			width: 4,
			height: 4,
			pixels: () => new Uint8Array(4 * 4 * 4)
		};
		const viewport: ViewportData = {
			pixelSize: 10,
			zoom: 1,
			panX: 0,
			panY: 0,
			showGrid: false,
			gridColor: '#000000',
			showOnionSkin: false
		};
		const viewportSize: ViewportSize = { width: 100, height: 100 };
		const reference: ReferenceLayerUnderlay = {
			sourceKey: 'reference-raster-cache',
			sourceRgba: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
			naturalWidth: 2,
			naturalHeight: 1,
			placement: { x: 0, y: 0, scale: 1 },
			projectedBounds: { minX: 0, minY: 0, maxX: 2, maxY: 1 },
			opacity: 1
		};
		const ctx = createContext();

		renderPixelCanvas(ctx as unknown as CanvasRenderingContext2D, canvas, viewport, viewportSize, reference);
		renderPixelCanvas(ctx as unknown as CanvasRenderingContext2D, canvas, viewport, viewportSize, {
			...reference,
			placement: { x: 1, y: 1, scale: 2 },
			projectedBounds: { minX: 1, minY: 1, maxX: 5, maxY: 3 }
		});

		const referenceRasters = FakeOffscreenCanvas.instances.filter(
			(instance) => instance.width === 2 && instance.height === 1
		);
		expect(referenceRasters).toHaveLength(1);
		expect(referenceRasters[0].putImageData).toHaveBeenCalledOnce();
		const drawCalls = ctx.calls.filter((call) => call[0] === 'drawImage');
		expect(drawCalls[0][1]).toBe(drawCalls[2][1]);
	});

	it('keeps multiple Reference sources warm across alternating renders', () => {
		vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
		vi.stubGlobal('ImageData', FakeImageData);

		const canvas: RenderableCanvas = {
			width: 4,
			height: 4,
			pixels: () => new Uint8Array(4 * 4 * 4)
		};
		const viewport: ViewportData = {
			pixelSize: 10,
			zoom: 1,
			panX: 0,
			panY: 0,
			showGrid: false,
			gridColor: '#000000',
			showOnionSkin: false
		};
		const viewportSize: ViewportSize = { width: 100, height: 100 };
		const referenceA: ReferenceLayerUnderlay = {
			sourceKey: 'reference-a',
			sourceRgba: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
			naturalWidth: 2,
			naturalHeight: 1,
			placement: { x: 0, y: 0, scale: 1 },
			projectedBounds: { minX: 0, minY: 0, maxX: 2, maxY: 1 },
			opacity: 1
		};
		const referenceB: ReferenceLayerUnderlay = {
			...referenceA,
			sourceKey: 'reference-b',
			sourceRgba: new Uint8Array([0, 0, 255, 255, 255, 255, 0, 255])
		};
		const ctx = createContext();

		renderPixelCanvas(ctx as unknown as CanvasRenderingContext2D, canvas, viewport, viewportSize, referenceA);
		renderPixelCanvas(ctx as unknown as CanvasRenderingContext2D, canvas, viewport, viewportSize, referenceB);
		renderPixelCanvas(ctx as unknown as CanvasRenderingContext2D, canvas, viewport, viewportSize, referenceA);

		const referenceRasters = FakeOffscreenCanvas.instances.filter(
			(instance) => instance.width === 2 && instance.height === 1
		);
		expect(referenceRasters).toHaveLength(2);
		expect(referenceRasters.every((raster) => raster.putImageData.mock.calls.length === 1)).toBe(true);
		const drawCalls = ctx.calls.filter((call) => call[0] === 'drawImage');
		expect(drawCalls[0][1]).toBe(drawCalls[4][1]);
		expect(drawCalls[0][1]).not.toBe(drawCalls[2][1]);
	});
});
