// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PixelCanvasView from './PixelCanvasView.svelte';
import type { ReferenceUnderlay, RenderableCanvas } from './renderer';
import type { ViewportData } from './viewport';

class FakeImageData {
	constructor(
		readonly data: Uint8ClampedArray,
		readonly width: number,
		readonly height: number
	) {}
}

class FakeOffscreenCanvas {
	constructor(
		readonly width: number,
		readonly height: number
	) {}

	getContext(type: '2d') {
		expect(type).toBe('2d');
		return { putImageData: vi.fn() };
	}
}

function createContext() {
	let alpha = 1;
	return {
		clearRect: vi.fn(),
		save: vi.fn(),
		restore: vi.fn(),
		translate: vi.fn(),
		fillRect: vi.fn(),
		beginPath: vi.fn(),
		rect: vi.fn(),
		clip: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
		drawImage: vi.fn(),
		set fillStyle(_value: string) {},
		set strokeStyle(_value: string) {},
		set lineWidth(_value: number) {},
		set imageSmoothingEnabled(_value: boolean) {},
		get globalAlpha() {
			return alpha;
		},
		set globalAlpha(value: number) {
			alpha = value;
		}
	};
}

const pixelCanvas: RenderableCanvas = {
	width: 4,
	height: 4,
	pixels: () => new Uint8Array(4 * 4 * 4)
};

const referenceUnderlay: ReferenceUnderlay = {
	sourceKey: 'reference-overlay',
	sourceRgba: new Uint8Array(2 * 1 * 4),
	naturalWidth: 2,
	naturalHeight: 1,
	placement: { x: 0.5, y: 1, scale: 2 },
	opacity: 1
};

const viewport: ViewportData = {
	pixelSize: 10,
	zoom: 1,
	panX: 3.2,
	panY: 4.6,
	showGrid: false,
	gridColor: '#000000'
};

beforeEach(() => {
	vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
	vi.stubGlobal('ImageData', FakeImageData);
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
		createContext() as unknown as CanvasRenderingContext2D
	);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('PixelCanvasView', () => {
	it('renders the Reference placement overlay when the Reference Layer is active', () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true
			}
		});

		expect(screen.getByTestId('reference-placement-overlay')).not.toBeNull();
	});

	it('does not render the Reference placement overlay while a Pixel Layer is active', () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: false
			}
		});

		expect(screen.queryByTestId('reference-placement-overlay')).toBeNull();
	});

	it('switches the placement handles to touch sizing after a touch pointer reaches the canvas', async () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		await fireEvent.pointerMove(canvas, { pointerType: 'touch', clientX: 1, clientY: 1 });

		expect(screen.getByTestId('reference-placement-overlay').style.getPropertyValue('--handle-size')).toBe(
			'16px'
		);
	});

	it('does not treat overlay handle presses as drawing input', async () => {
		const onDrawStart = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				onDrawStart
			}
		});

		await fireEvent.pointerDown(screen.getAllByTestId('reference-placement-handle')[0], {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0
		});

		expect(onDrawStart).not.toHaveBeenCalled();
	});

	it('keeps middle-drag panning available from the read-only overlay', async () => {
		const onDrawStart = vi.fn();
		const onViewportChange = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				onDrawStart,
				onViewportChange
			}
		});

		const handle = screen.getAllByTestId('reference-placement-handle')[0];
		await fireEvent.pointerDown(handle, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 1,
			clientX: 10,
			clientY: 10
		});
		await fireEvent.pointerMove(handle, {
			pointerId: 1,
			pointerType: 'mouse',
			buttons: 4,
			clientX: 20,
			clientY: 25
		});

		expect(onDrawStart).not.toHaveBeenCalled();
		expect(onViewportChange).toHaveBeenCalled();
	});

	it('keeps Space-drag panning available from the read-only overlay', async () => {
		const onDrawStart = vi.fn();
		const onViewportChange = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				isSpaceHeld: true,
				onDrawStart,
				onViewportChange
			}
		});

		const handle = screen.getAllByTestId('reference-placement-handle')[0];
		await fireEvent.pointerDown(handle, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 10,
			clientY: 10
		});
		await fireEvent.pointerMove(handle, {
			pointerId: 1,
			pointerType: 'mouse',
			buttons: 1,
			clientX: 20,
			clientY: 25
		});

		expect(onDrawStart).not.toHaveBeenCalled();
		expect(onViewportChange).toHaveBeenCalled();
	});

	it('keeps touch pinch zoom available from the read-only overlay', async () => {
		const onDrawStart = vi.fn();
		const onViewportChange = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				onDrawStart,
				onViewportChange
			}
		});

		const handle = screen.getAllByTestId('reference-placement-handle')[0];
		await fireEvent.pointerDown(handle, {
			pointerId: 1,
			pointerType: 'touch',
			button: 0,
			clientX: 10,
			clientY: 10
		});
		await fireEvent.pointerDown(handle, {
			pointerId: 2,
			pointerType: 'touch',
			button: 0,
			clientX: 40,
			clientY: 10
		});
		await fireEvent.pointerMove(handle, {
			pointerId: 2,
			pointerType: 'touch',
			clientX: 80,
			clientY: 10
		});

		expect(onDrawStart).not.toHaveBeenCalled();
		expect(onViewportChange).toHaveBeenCalled();
	});
});
