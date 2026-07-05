import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearReferenceRasterCache, renderPixelCanvas } from './renderer';
import type { ReferenceLayerUnderlay } from './reference-layer-underlay';
import type { RenderableCanvas } from './renderer';
import type { OnionSkinGhostRead } from './editor-session/onion-skin';
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
	/** Recorded context mutations beyond putImageData (Onion Skin tint fills). */
	readonly ops: unknown[][] = [];

	constructor(
		readonly width: number,
		readonly height: number
	) {
		FakeOffscreenCanvas.instances.push(this);
	}

	getContext(type: '2d') {
		expect(type).toBe('2d');
		const ops = this.ops;
		return {
			putImageData: this.putImageData,
			fillRect: (x: number, y: number, width: number, height: number) =>
				ops.push(['fillRect', x, y, width, height]),
			set globalCompositeOperation(value: string) {
				ops.push(['globalCompositeOperation', value]);
			},
			set globalAlpha(value: number) {
				ops.push(['globalAlpha', value]);
			},
			set fillStyle(value: string) {
				ops.push(['fillStyle', value]);
			}
		};
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
		set imageSmoothingEnabled(value: boolean) {
			calls.push(['imageSmoothingEnabled', value]);
		},
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

	it('draws Onion Skin ghosts after the Reference underlay and before the pixel composite, farthest first, tinted per kind at ghost alpha', () => {
		vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
		vi.stubGlobal('ImageData', FakeImageData);

		const canvas: RenderableCanvas = {
			width: 4,
			height: 4,
			pixels: () => new Uint8Array(4 * 4 * 4)
		};
		const reference: ReferenceLayerUnderlay = {
			sourceKey: 'onion-skin-draw-order',
			sourceRgba: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
			naturalWidth: 2,
			naturalHeight: 1,
			placement: { x: 0, y: 0, scale: 1 },
			projectedBounds: { minX: 0, minY: 0, maxX: 2, maxY: 1 },
			opacity: 1
		};
		const ghosts: OnionSkinGhostRead[] = [
			{ frameId: 'frame-prev', kind: 'previous', distance: 1, pixels: new Uint8Array(4 * 4 * 4) },
			{ frameId: 'frame-next-2', kind: 'next', distance: 2, pixels: new Uint8Array(4 * 4 * 4) }
		];
		const viewport: ViewportData = {
			pixelSize: 10,
			zoom: 1,
			panX: 0,
			panY: 0,
			showGrid: false,
			gridColor: '#000000',
			showOnionSkin: true
		};
		const viewportSize: ViewportSize = { width: 100, height: 100 };
		const ctx = createContext();

		renderPixelCanvas(
			ctx as unknown as CanvasRenderingContext2D,
			canvas,
			viewport,
			viewportSize,
			reference,
			ghosts
		);

		// Draw order: Reference underlay → ghosts (farthest first: next d2, then
		// previous d1) → pixel composite, all scaled to the 40×40 display rect.
		const drawCalls = ctx.calls.filter((call) => call[0] === 'drawImage');
		expect(drawCalls).toHaveLength(4);
		const farGhostRaster = drawCalls[1][1] as FakeOffscreenCanvas;
		const nearGhostRaster = drawCalls[2][1] as FakeOffscreenCanvas;
		const compositeRaster = drawCalls[3][1] as FakeOffscreenCanvas;
		expect((drawCalls[0][1] as FakeOffscreenCanvas).width).toBe(2);
		expect(drawCalls[1].slice(2)).toEqual([0, 0, 40, 40]);
		expect(drawCalls[2].slice(2)).toEqual([0, 0, 40, 40]);

		// Each ghost raster is tinted through a transparency-preserving
		// source-atop fill: 60% of the kind tint over the ghost's own colors.
		expect(farGhostRaster.ops).toEqual([
			['globalCompositeOperation', 'source-atop'],
			['globalAlpha', 0.6],
			['fillStyle', '#3B82F6'],
			['fillRect', 0, 0, 4, 4]
		]);
		expect(nearGhostRaster.ops).toEqual([
			['globalCompositeOperation', 'source-atop'],
			['globalAlpha', 0.6],
			['fillStyle', '#E5484D'],
			['fillRect', 0, 0, 4, 4]
		]);
		expect(compositeRaster.ops).toEqual([]);

		// Ghost blits are dimmed to the ghost alpha and the previous alpha is
		// restored before the composite draws at full strength. (The alpha
		// restore is searched after the last ghost draw — the Reference underlay
		// resets its own alpha earlier.)
		const alphaDown = ctx.calls.findIndex((call) => call[0] === 'globalAlpha' && call[1] === 0.4);
		const firstGhostDraw = ctx.calls.findIndex((call) => call[1] === farGhostRaster);
		const lastGhostDraw = ctx.calls.findIndex((call) => call[1] === nearGhostRaster);
		const compositeDraw = ctx.calls.findIndex((call) => call[1] === compositeRaster);
		const alphaRestore = ctx.calls.findIndex(
			(call, index) => index > lastGhostDraw && call[0] === 'globalAlpha' && call[1] === 1
		);
		expect(alphaDown).toBeGreaterThan(-1);
		expect(alphaDown).toBeLessThan(firstGhostDraw);
		expect(alphaRestore).toBeGreaterThan(lastGhostDraw);
		expect(alphaRestore).toBeLessThan(compositeDraw);

		// Nearest-neighbor blits: smoothing is off before the ghost draws.
		const smoothingOff = ctx.calls.findIndex(
			(call) => call[0] === 'imageSmoothingEnabled' && call[1] === false
		);
		expect(smoothingOff).toBeGreaterThan(-1);
		expect(smoothingOff).toBeLessThan(firstGhostDraw);
	});

	it('draws nothing extra for an empty ghost list', () => {
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
			showOnionSkin: true
		};
		const viewportSize: ViewportSize = { width: 100, height: 100 };
		const ctx = createContext();

		renderPixelCanvas(
			ctx as unknown as CanvasRenderingContext2D,
			canvas,
			viewport,
			viewportSize,
			undefined,
			[]
		);

		// Exactly one draw (the pixel composite), no tint fills, no alpha dip.
		const drawCalls = ctx.calls.filter((call) => call[0] === 'drawImage');
		expect(drawCalls).toHaveLength(1);
		expect(FakeOffscreenCanvas.instances.every((instance) => instance.ops.length === 0)).toBe(
			true
		);
		expect(ctx.calls.some((call) => call[0] === 'globalAlpha' && call[1] === 0.4)).toBe(false);
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
