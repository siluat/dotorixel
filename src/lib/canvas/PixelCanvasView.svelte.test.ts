// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PixelCanvasView from './PixelCanvasView.svelte';
import type { ToolType } from './tool-registry';
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

const squareReferenceUnderlay: ReferenceUnderlay = {
	sourceKey: 'reference-overlay-square',
	sourceRgba: new Uint8Array(4 * 4 * 4),
	naturalWidth: 4,
	naturalHeight: 4,
	placement: { x: 1, y: 1, scale: 2 },
	opacity: 1
};

const largeSquareReferenceUnderlay: ReferenceUnderlay = {
	...squareReferenceUnderlay,
	sourceKey: 'reference-overlay-large-square',
	placement: { x: 1, y: 1, scale: 3 }
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
	const drawingTools: readonly ToolType[] = [
		'pencil',
		'eraser',
		'floodfill',
		'line',
		'rectangle',
		'ellipse'
	];

	it.each(drawingTools)('uses not-allowed cursor for %s while Reference is active', (activeTool) => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				activeTool,
				toolCursor: 'crosshair'
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		expect(canvas.style.cursor).toBe('not-allowed');
	});

	it('uses not-allowed cursor over the Reference image body for drawing tools', () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				activeTool: 'pencil',
				toolCursor: 'crosshair'
			}
		});

		expect(screen.getByTestId('reference-placement-overlay').style.cursor).toBe('not-allowed');
	});

	it('keeps the Move cursor while Reference is active', () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				activeTool: 'move',
				toolCursor: 'move'
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		expect(canvas.style.cursor).toBe('move');
		expect(screen.getByTestId('reference-placement-overlay').style.cursor).toBe('move');
	});

	it('keeps the normal drawing cursor after switching back to a Pixel Layer', () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: false,
				activeTool: 'pencil',
				toolCursor: 'crosshair'
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		expect(canvas.style.cursor).toBe('crosshair');
	});

	it('keeps the Space-pan cursor over the Reference image body', () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				activeTool: 'pencil',
				toolCursor: 'crosshair',
				isSpaceHeld: true
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		expect(canvas.style.cursor).toBe('grab');
		expect(screen.getByTestId('reference-placement-overlay').style.cursor).toBe('grab');
	});

	it('does not apply the desktop blocked cursor after touch input reaches the canvas', async () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				activeTool: 'pencil',
				toolCursor: 'crosshair'
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		await fireEvent.pointerMove(canvas, { pointerType: 'touch', clientX: 1, clientY: 1 });

		expect(canvas.style.cursor).toBe('crosshair');
	});

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

	it('commits a body drag as a translated Reference placement on release', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				activeTool: 'move',
				onReferencePlacementCommit
			}
		});

		const overlay = screen.getByTestId('reference-placement-overlay');
		await fireEvent.pointerDown(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 10,
			clientY: 20
		});
		await fireEvent.pointerMove(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			buttons: 1,
			clientX: 30,
			clientY: 10
		});
		await fireEvent.pointerUp(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 30,
			clientY: 10
		});

		expect(onReferencePlacementCommit).toHaveBeenCalledTimes(1);
		expect(onReferencePlacementCommit).toHaveBeenCalledWith({ x: 2.5, y: 0, scale: 2 });
	});

	it('commits a one-pixel Reference placement nudge from ArrowRight when the canvas is focused', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				onReferencePlacementCommit
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		await fireEvent.keyDown(canvas, { code: 'ArrowRight', key: 'ArrowRight' });

		expect(onReferencePlacementCommit).toHaveBeenCalledTimes(1);
		expect(onReferencePlacementCommit).toHaveBeenCalledWith({ x: 1.5, y: 1, scale: 2 });
	});

	it('maps every arrow key to a one-pixel Reference placement nudge', async () => {
		const cases = [
			['ArrowUp', { x: 0.5, y: 0, scale: 2 }],
			['ArrowDown', { x: 0.5, y: 2, scale: 2 }],
			['ArrowLeft', { x: -0.5, y: 1, scale: 2 }],
			['ArrowRight', { x: 1.5, y: 1, scale: 2 }]
		] as const;

		for (const [code, expected] of cases) {
			cleanup();
			const onReferencePlacementCommit = vi.fn();
			render(PixelCanvasView, {
				props: {
					pixelCanvas,
					referenceUnderlay,
					viewport,
					viewportSize: { width: 100, height: 100 },
					isReferenceLayerActive: true,
					onReferencePlacementCommit
				}
			});

			const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
			await fireEvent.keyDown(canvas, { code, key: code });

			expect(onReferencePlacementCommit).toHaveBeenCalledWith(expected);
		}
	});

	it('commits a ten-pixel Reference placement nudge from Shift+ArrowUp', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				onReferencePlacementCommit
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		await fireEvent.keyDown(canvas, { code: 'ArrowUp', key: 'ArrowUp', shiftKey: true });

		expect(onReferencePlacementCommit).toHaveBeenCalledTimes(1);
		expect(onReferencePlacementCommit).toHaveBeenCalledWith({ x: 0.5, y: -9, scale: 2 });
	});

	it('commits repeated Reference placement nudges as separate accumulated placements', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				onReferencePlacementCommit
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		await fireEvent.keyDown(canvas, { code: 'ArrowRight', key: 'ArrowRight' });
		await fireEvent.keyDown(canvas, { code: 'ArrowRight', key: 'ArrowRight', repeat: true });

		expect(onReferencePlacementCommit).toHaveBeenNthCalledWith(1, { x: 1.5, y: 1, scale: 2 });
		expect(onReferencePlacementCommit).toHaveBeenNthCalledWith(2, { x: 2.5, y: 1, scale: 2 });
	});

	it('keeps accumulating repeated Reference placement nudges across unrelated renderVersion bumps', async () => {
		const onReferencePlacementCommit = vi.fn();
		const { rerender } = render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				renderVersion: 0,
				isReferenceLayerActive: true,
				onReferencePlacementCommit
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		await fireEvent.keyDown(canvas, { code: 'ArrowRight', key: 'ArrowRight' });
		await rerender({
			pixelCanvas,
			referenceUnderlay,
			viewport,
			viewportSize: { width: 100, height: 100 },
			renderVersion: 1,
			isReferenceLayerActive: true,
			onReferencePlacementCommit
		});
		await fireEvent.keyDown(canvas, { code: 'ArrowRight', key: 'ArrowRight', repeat: true });

		expect(onReferencePlacementCommit).toHaveBeenNthCalledWith(1, { x: 1.5, y: 1, scale: 2 });
		expect(onReferencePlacementCommit).toHaveBeenNthCalledWith(2, { x: 2.5, y: 1, scale: 2 });
	});

	it('previews the nudged Reference placement in the overlay immediately', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				onReferencePlacementCommit
			}
		});

		const overlay = screen.getByTestId('reference-placement-overlay');
		expect(overlay.style.left).toBe('8px');
		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		await fireEvent.keyDown(canvas, { code: 'ArrowRight', key: 'ArrowRight' });
		await tick();

		expect(overlay.style.left).toBe('18px');
		expect(overlay.style.top).toBe('15px');
	});

	it('allows Reference placement nudge after the overlay gives focus back to the canvas', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				activeTool: 'pencil',
				onReferencePlacementCommit
			}
		});

		const overlay = screen.getByTestId('reference-placement-overlay');
		await fireEvent.pointerDown(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 10,
			clientY: 20
		});
		await fireEvent.keyDown(document.activeElement ?? document.body, {
			code: 'ArrowRight',
			key: 'ArrowRight'
		});

		expect(onReferencePlacementCommit).toHaveBeenCalledWith({ x: 1.5, y: 1, scale: 2 });
	});

	it('does not nudge Reference placement from a non-canvas keyboard target', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				onReferencePlacementCommit
			}
		});

		await fireEvent.keyDown(document.body, { code: 'ArrowRight', key: 'ArrowRight' });

		expect(onReferencePlacementCommit).not.toHaveBeenCalled();
	});

	it('does not nudge Reference placement while a Pixel Layer is active', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: false,
				onReferencePlacementCommit
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		await fireEvent.keyDown(canvas, { code: 'ArrowRight', key: 'ArrowRight' });

		expect(onReferencePlacementCommit).not.toHaveBeenCalled();
	});

	it('does not nudge Reference placement during an active placement drag', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				activeTool: 'move',
				onReferencePlacementCommit
			}
		});

		const overlay = screen.getByTestId('reference-placement-overlay');
		await fireEvent.pointerDown(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 10,
			clientY: 20
		});
		await fireEvent.keyDown(screen.getByRole('application', { name: 'Pixel art canvas' }), {
			code: 'ArrowRight',
			key: 'ArrowRight'
		});

		expect(onReferencePlacementCommit).not.toHaveBeenCalled();
	});

	it('does not move the Reference placement from the overlay body unless the Move tool is active', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				activeTool: 'pencil',
				onReferencePlacementCommit
			}
		});

		const overlay = screen.getByTestId('reference-placement-overlay');
		await fireEvent.pointerDown(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 10,
			clientY: 20
		});
		await fireEvent.pointerMove(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			buttons: 1,
			clientX: 30,
			clientY: 10
		});
		await fireEvent.pointerUp(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 30,
			clientY: 10
		});

		expect(overlay.style.left).toBe('8px');
		expect(overlay.style.top).toBe('15px');
		expect(onReferencePlacementCommit).not.toHaveBeenCalled();
	});

	it('previews a body drag before committing the Reference placement', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				activeTool: 'move',
				onReferencePlacementCommit
			}
		});

		const overlay = screen.getByTestId('reference-placement-overlay');
		await fireEvent.pointerDown(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 10,
			clientY: 20
		});
		await fireEvent.pointerMove(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			buttons: 1,
			clientX: 30,
			clientY: 10
		});
		await tick();

		expect(overlay.style.left).toBe('28px');
		expect(overlay.style.top).toBe('5px');
		expect(onReferencePlacementCommit).not.toHaveBeenCalled();
	});

	it('commits a corner-handle drag as a uniform Reference scale around the opposite corner', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay: squareReferenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				onReferencePlacementCommit
			}
		});

		const southeastHandle = screen.getAllByTestId('reference-placement-handle')[2];
		await fireEvent.pointerDown(southeastHandle, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 45,
			clientY: 30
		});
		await fireEvent.pointerMove(southeastHandle, {
			pointerId: 1,
			pointerType: 'mouse',
			buttons: 1,
			clientX: 65,
			clientY: 50
		});
		await fireEvent.pointerUp(southeastHandle, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 65,
			clientY: 50
		});

		expect(onReferencePlacementCommit).toHaveBeenCalledTimes(1);
		expect(onReferencePlacementCommit).toHaveBeenCalledWith({ x: 1, y: 1, scale: 2.5 });
	});

	it('clamps corner-handle scaling to an 8x8 document-pixel footprint', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay: largeSquareReferenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				onReferencePlacementCommit
			}
		});

		const southeastHandle = screen.getAllByTestId('reference-placement-handle')[2];
		await fireEvent.pointerDown(southeastHandle, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 45,
			clientY: 30
		});
		await fireEvent.pointerMove(southeastHandle, {
			pointerId: 1,
			pointerType: 'mouse',
			buttons: 1,
			clientX: -55,
			clientY: -70
		});
		await fireEvent.pointerUp(southeastHandle, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: -55,
			clientY: -70
		});

		expect(onReferencePlacementCommit).toHaveBeenCalledWith({ x: 1, y: 1, scale: 2 });
	});

	it('cancels an in-flight Reference placement drag on Escape without committing', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				activeTool: 'move',
				onReferencePlacementCommit
			}
		});

		const overlay = screen.getByTestId('reference-placement-overlay');
		await fireEvent.pointerDown(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 10,
			clientY: 20
		});
		await fireEvent.pointerMove(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			buttons: 1,
			clientX: 30,
			clientY: 10
		});
		await tick();

		expect(overlay.style.left).toBe('28px');
		expect(overlay.style.top).toBe('5px');

		await fireEvent.keyDown(window, { key: 'Escape' });
		await tick();

		expect(overlay.style.left).toBe('8px');
		expect(overlay.style.top).toBe('15px');
		expect(onReferencePlacementCommit).not.toHaveBeenCalled();
	});

	it('cancels an in-flight Reference placement drag on pointer cancel without committing', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				activeTool: 'move',
				onReferencePlacementCommit
			}
		});

		const overlay = screen.getByTestId('reference-placement-overlay');
		await fireEvent.pointerDown(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 10,
			clientY: 20
		});
		await fireEvent.pointerMove(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			buttons: 1,
			clientX: 30,
			clientY: 10
		});
		await tick();

		expect(overlay.style.left).toBe('28px');
		expect(overlay.style.top).toBe('5px');

		await fireEvent.pointerCancel(overlay, { pointerId: 1, pointerType: 'mouse' });
		await tick();

		expect(overlay.style.left).toBe('8px');
		expect(overlay.style.top).toBe('15px');
		expect(onReferencePlacementCommit).not.toHaveBeenCalled();
	});

	it('commits a one-touch body drag as a translated Reference placement', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				activeTool: 'move',
				onReferencePlacementCommit
			}
		});

		const overlay = screen.getByTestId('reference-placement-overlay');
		await fireEvent.pointerDown(overlay, {
			pointerId: 1,
			pointerType: 'touch',
			button: 0,
			clientX: 10,
			clientY: 20
		});
		await fireEvent.pointerMove(overlay, {
			pointerId: 1,
			pointerType: 'touch',
			buttons: 1,
			clientX: 30,
			clientY: 10
		});
		await fireEvent.pointerUp(overlay, {
			pointerId: 1,
			pointerType: 'touch',
			button: 0,
			clientX: 30,
			clientY: 10
		});

		expect(onReferencePlacementCommit).toHaveBeenCalledTimes(1);
		expect(onReferencePlacementCommit).toHaveBeenCalledWith({ x: 2.5, y: 0, scale: 2 });
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
		await tick();

		expect(onDrawStart).not.toHaveBeenCalled();
		expect(onViewportChange).toHaveBeenCalled();
		expect(screen.getByTestId('reference-placement-overlay').style.cursor).toBe('grabbing');
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

	it('clears pending overlay touches when the Reference overlay unmounts', async () => {
		const onDrawStart = vi.fn();
		const onDraw = vi.fn();
		const { rerender } = render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				onDrawStart,
				onDraw
			}
		});

		await fireEvent.pointerDown(screen.getAllByTestId('reference-placement-handle')[0], {
			pointerId: 1,
			pointerType: 'touch',
			button: 0,
			clientX: 10,
			clientY: 10
		});

		await rerender({
			pixelCanvas,
			referenceUnderlay,
			viewport,
			viewportSize: { width: 100, height: 100 },
			isReferenceLayerActive: false,
			onDrawStart,
			onDraw
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		await fireEvent.pointerDown(canvas, {
			pointerId: 2,
			pointerType: 'touch',
			button: 0,
			clientX: 80,
			clientY: 10
		});
		await fireEvent.pointerMove(canvas, {
			pointerId: 2,
			pointerType: 'touch',
			clientX: 82,
			clientY: 10
		});

		expect(onDrawStart).toHaveBeenCalledTimes(1);
		expect(onDraw).toHaveBeenCalledTimes(1);
	});

	it('ignores unrelated window pointer cancellations during an active canvas draw', async () => {
		const onDrawStart = vi.fn();
		const onDraw = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				viewport,
				viewportSize: { width: 100, height: 100 },
				onDrawStart,
				onDraw
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		await fireEvent.pointerDown(canvas, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 10,
			clientY: 10
		});
		onDraw.mockClear();

		await fireEvent.pointerCancel(window, {
			pointerId: 99,
			pointerType: 'touch'
		});
		await fireEvent.pointerMove(canvas, {
			pointerId: 1,
			pointerType: 'mouse',
			clientX: 20,
			clientY: 10
		});

		expect(onDrawStart).toHaveBeenCalledTimes(1);
		expect(onDraw).toHaveBeenCalledTimes(1);
	});

	it('keeps trackpad panning available from the read-only overlay', () => {
		const onViewportChange = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				onViewportChange
			}
		});

		const event = new WheelEvent('wheel', {
			bubbles: true,
			cancelable: true,
			deltaX: 8,
			deltaY: 2,
			deltaMode: 0,
			clientX: 24,
			clientY: 32
		});
		screen.getByTestId('reference-placement-overlay').dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
		expect(onViewportChange).toHaveBeenCalledTimes(1);
	});
});
