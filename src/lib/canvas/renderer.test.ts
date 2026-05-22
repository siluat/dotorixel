import { describe, expect, it, vi } from 'vitest';
import { renderPixelCanvas, type ReferenceUnderlay } from './renderer';
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
	readonly putImageData = vi.fn();

	constructor(
		readonly width: number,
		readonly height: number
	) {}

	getContext(type: '2d') {
		expect(type).toBe('2d');
		return { putImageData: this.putImageData };
	}
}

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
		const reference: ReferenceUnderlay = {
			sourceRgba: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
			naturalWidth: 2,
			naturalHeight: 1,
			placement: { x: 0.5, y: 1, scale: 2 },
			opacity: 0.5
		};
		const viewport: ViewportData = {
			pixelSize: 10,
			zoom: 1,
			panX: 3.2,
			panY: 4.6,
			showGrid: false,
			gridColor: '#000000'
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
});
