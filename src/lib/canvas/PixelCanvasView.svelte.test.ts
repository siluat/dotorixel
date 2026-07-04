// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PixelCanvasView from './PixelCanvasView.svelte';
import type { MarqueeRegion } from './canvas-model';
import type { ToolType } from './tool-registry';
import type { RenderableCanvas } from './renderer';
import type { ReferenceLayerUnderlay } from './reference-layer-underlay';
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

const referenceLayerUnderlay: ReferenceLayerUnderlay = {
	sourceKey: 'reference-overlay',
	sourceRgba: new Uint8Array(2 * 1 * 4),
	naturalWidth: 2,
	naturalHeight: 1,
	placement: { x: 0.5, y: 1, scale: 2 },
	projectedBounds: { minX: 0.5, minY: 1, maxX: 4.5, maxY: 3 },
	opacity: 1
};

const squareReferenceLayerUnderlay: ReferenceLayerUnderlay = {
	sourceKey: 'reference-overlay-square',
	sourceRgba: new Uint8Array(4 * 4 * 4),
	naturalWidth: 4,
	naturalHeight: 4,
	placement: { x: 1, y: 1, scale: 2 },
	projectedBounds: { minX: 1, minY: 1, maxX: 9, maxY: 9 },
	opacity: 1
};

const largeSquareReferenceLayerUnderlay: ReferenceLayerUnderlay = {
	...squareReferenceLayerUnderlay,
	sourceKey: 'reference-overlay-large-square',
	placement: { x: 1, y: 1, scale: 3 },
	projectedBounds: { minX: 1, minY: 1, maxX: 13, maxY: 13 }
};

const viewport: ViewportData = {
	pixelSize: 10,
	zoom: 1,
	panX: 3.2,
	panY: 4.6,
	showGrid: false,
	gridColor: '#000000'
};

function marqueeRegion(overrides: Partial<MarqueeRegion> = {}): MarqueeRegion {
	return {
		x: 1,
		y: 1,
		width: 2,
		height: 2,
		contains: () => false,
		translate: () => marqueeRegion(),
		clip_to: () => undefined,
		...overrides
	};
}

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
		'ellipse',
		'selection'
	];

	it.each(drawingTools)('uses not-allowed cursor for %s while Reference is active', (activeTool) => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceLayerUnderlay,
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

	it('mounts the Selection overlay when a Marquee is active', () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				marquee: {
					x: 1,
					y: 1,
					width: 2,
					height: 2,
					contains: () => false,
					translate: () => null!,
					clip_to: () => undefined
				},
				viewport,
				viewportSize: { width: 100, height: 100 }
			}
		});

		expect(screen.getByTestId('selection-overlay')).toBeTruthy();
	});

	it('mounts the Selection Action Bar for an idle Marquee', () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				marquee: marqueeRegion(),
				viewport,
				viewportSize: { width: 180, height: 180 },
				canPasteSelection: true
			}
		});

		expect(screen.getByRole('group', { name: 'Selection actions' })).toBeTruthy();
	});

	it('hides the Selection Action Bar while a Reference Layer is active', () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				marquee: marqueeRegion(),
				referenceLayerUnderlay,
				isReferenceLayerActive: true,
				viewport,
				viewportSize: { width: 180, height: 180 },
				canPasteSelection: true
			}
		});

		expect(screen.queryByRole('group', { name: 'Selection actions' })).toBeNull();
	});

	it('hides the Marquee outline while a Reference Layer is active', () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				marquee: marqueeRegion(),
				referenceLayerUnderlay,
				isReferenceLayerActive: true,
				viewport,
				viewportSize: { width: 180, height: 180 }
			}
		});

		expect(screen.queryByTestId('selection-overlay')).toBeNull();
	});

	it('mounts the Floating Selection Action Bar during a Floating Selection', async () => {
		const handlers = {
			onCommitFloatingSelection: vi.fn(),
			onClearMarqueeOrFloating: vi.fn(),
			onDuplicateFloatingSelection: vi.fn()
		};

		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				marquee: marqueeRegion(),
				floatingSelectionOffset: { dx: 1, dy: -1 },
				viewport,
				viewportSize: { width: 180, height: 180 },
				canPasteSelection: true,
				...handlers
			}
		});

		expect(screen.getByRole('group', { name: 'Selection actions' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Cut' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Paste' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Deselect' })).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

		expect(handlers.onCommitFloatingSelection).toHaveBeenCalledOnce();
		expect(handlers.onClearMarqueeOrFloating).toHaveBeenCalledOnce();
		expect(handlers.onDuplicateFloatingSelection).toHaveBeenCalledOnce();
	});

	it('hides the Selection Action Bar during canvas pointer drag', async () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				marquee: marqueeRegion({ width: 3, height: 2 }),
				viewport,
				viewportSize: { width: 180, height: 180 },
				activeTool: 'selection'
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		await fireEvent.pointerDown(canvas, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 30,
			clientY: 40
		});
		await fireEvent.pointerMove(canvas, {
			pointerId: 1,
			pointerType: 'mouse',
			buttons: 1,
			clientX: 60,
			clientY: 70
		});

		expect(
			screen
				.getByTestId('selection-action-bar')
				.classList.contains('selection-action-bar--hidden')
		).toBe(true);

		await fireEvent.pointerUp(window, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 60,
			clientY: 70
		});

		expect(
			screen
				.getByTestId('selection-action-bar')
				.classList.contains('selection-action-bar--hidden')
		).toBe(false);
	});

	it('passes Floating Selection offset to the Selection overlay', () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				marquee: marqueeRegion(),
				floatingSelectionOffset: { dx: 1, dy: -1 },
				viewport,
				viewportSize: { width: 100, height: 100 }
			}
		});

		const overlay = screen.getByTestId('selection-overlay');

		expect(overlay.style.left).toBe('23px');
		expect(overlay.style.top).toBe('5px');
		expect(overlay.style.width).toBe('20px');
		expect(overlay.style.height).toBe('20px');
	});

	it.each(['mouse', 'pen', 'touch'] as const)(
		'renders Selection drag aids only while defining a Marquee with %s input',
		async (pointerType) => {
			const props = {
				pixelCanvas,
				viewport,
				viewportSize: { width: 100, height: 100 },
				activeTool: 'selection' as const
			};
			const { rerender } = render(PixelCanvasView, {
				props: {
					...props,
					marquee: null
				}
			});

			const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
			await fireEvent.pointerDown(canvas, {
				pointerId: 1,
				pointerType,
				button: 0,
				clientX: 30,
				clientY: 40
			});
			await fireEvent.pointerMove(canvas, {
				pointerId: 1,
				pointerType,
				buttons: 1,
				clientX: 60,
				clientY: 70
			});
			await rerender({
				...props,
				marquee: marqueeRegion({ width: 3, height: 2 })
			});

			expect(screen.getByTestId('selection-drag-tooltip').textContent).toBe('3×2');
			expect(screen.getByTestId('selection-drag-guides').getAttribute('viewBox')).toBe(
				'0 0 100 100'
			);

			await fireEvent.pointerUp(window, {
				pointerId: 1,
				pointerType,
				button: 0,
				clientX: 60,
				clientY: 70
			});
			await rerender({
				...props,
				marquee: marqueeRegion({ width: 3, height: 2 })
			});

			expect(screen.queryByTestId('selection-drag-tooltip')).toBeNull();
			expect(screen.queryByTestId('selection-drag-guides')).toBeNull();
		}
	);

	it('does not render Selection drag aids during LiftAndDrag', async () => {
		const props = {
			pixelCanvas,
			viewport,
			viewportSize: { width: 100, height: 100 },
			activeTool: 'selection' as const,
			selectionDragPhase: 'liftAndDrag' as const
		};
		const { rerender } = render(PixelCanvasView, {
			props: {
				...props,
				marquee: null
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		await fireEvent.pointerDown(canvas, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 30,
			clientY: 40
		});
		await fireEvent.pointerMove(canvas, {
			pointerId: 1,
			pointerType: 'mouse',
			buttons: 1,
			clientX: 60,
			clientY: 70
		});
		await rerender({
			...props,
			marquee: marqueeRegion({ width: 3, height: 2 })
		});

		expect(screen.queryByTestId('selection-drag-tooltip')).toBeNull();
		expect(screen.queryByTestId('selection-drag-guides')).toBeNull();
	});

	it('treats an active Floating Selection offset as LiftAndDrag for drag aids', async () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				marquee: marqueeRegion({ width: 3, height: 2 }),
				floatingSelectionOffset: { dx: 1, dy: 1 },
				viewport,
				viewportSize: { width: 100, height: 100 },
				activeTool: 'selection'
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		await fireEvent.pointerDown(canvas, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 30,
			clientY: 40
		});
		await fireEvent.pointerMove(canvas, {
			pointerId: 1,
			pointerType: 'mouse',
			buttons: 1,
			clientX: 60,
			clientY: 70
		});

		expect(screen.queryByTestId('selection-drag-tooltip')).toBeNull();
		expect(screen.queryByTestId('selection-drag-guides')).toBeNull();
	});

	it('uses move and grabbing cursors for Selection move affordances', async () => {
		const selectionViewport = {
			...viewport,
			panX: 0,
			panY: 0,
			pixelSize: 10,
			zoom: 1
		};
		const props = {
			pixelCanvas,
			marquee: marqueeRegion({
				contains: (x, y) => x >= 1 && y >= 1 && x < 3 && y < 3
			}),
			viewport: selectionViewport,
			viewportSize: { width: 100, height: 100 },
			activeTool: 'selection' as const,
			toolCursor: 'crosshair'
		};
		const { rerender } = render(PixelCanvasView, { props });
		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });

		await fireEvent.pointerMove(canvas, {
			pointerId: 1,
			pointerType: 'mouse',
			clientX: 15,
			clientY: 15
		});
		await tick();
		expect(canvas.style.cursor).toBe('move');

		await fireEvent.pointerMove(canvas, {
			pointerId: 1,
			pointerType: 'mouse',
			clientX: 35,
			clientY: 35
		});
		await tick();
		expect(canvas.style.cursor).toBe('crosshair');

		await rerender({
			...props,
			floatingSelectionOffset: { dx: 1, dy: 0 }
		});
		await tick();
		expect(canvas.style.cursor).toBe('grabbing');
	});

	it('does not render Selection drag aids on pointer down before a drag begins', async () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				marquee: marqueeRegion({ width: 3, height: 2 }),
				viewport,
				viewportSize: { width: 100, height: 100 },
				activeTool: 'selection'
			}
		});

		const canvas = screen.getByRole('application', { name: 'Pixel art canvas' });
		await fireEvent.pointerDown(canvas, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 30,
			clientY: 40
		});

		expect(screen.queryByTestId('selection-drag-tooltip')).toBeNull();
		expect(screen.queryByTestId('selection-drag-guides')).toBeNull();
	});

	it('restores the hidden selection UI unchanged after switching back to a Pixel Layer', async () => {
		const { rerender } = render(PixelCanvasView, {
			props: {
				pixelCanvas,
				marquee: marqueeRegion(),
				referenceLayerUnderlay,
				isReferenceLayerActive: false,
				viewport,
				viewportSize: { width: 180, height: 180 }
			}
		});
		const pixelOverlay = screen.getByTestId('selection-overlay');
		const pixelGeometry = {
			left: pixelOverlay.style.left,
			top: pixelOverlay.style.top,
			width: pixelOverlay.style.width,
			height: pixelOverlay.style.height
		};
		expect(screen.getByRole('group', { name: 'Selection actions' })).toBeTruthy();

		await rerender({ isReferenceLayerActive: true });
		expect(screen.queryByTestId('selection-overlay')).toBeNull();
		expect(screen.queryByRole('group', { name: 'Selection actions' })).toBeNull();

		await rerender({ isReferenceLayerActive: false });
		const restoredOverlay = screen.getByTestId('selection-overlay');

		expect({
			left: restoredOverlay.style.left,
			top: restoredOverlay.style.top,
			width: restoredOverlay.style.width,
			height: restoredOverlay.style.height
		}).toEqual(pixelGeometry);
		expect(screen.getByRole('group', { name: 'Selection actions' })).toBeTruthy();
	});

	it('uses not-allowed cursor over the Reference image body for drawing tools', () => {
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
					referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
			referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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

	it('forwards Eyedropper clicks from the Reference overlay body to the draw lifecycle', async () => {
		const onDrawStart = vi.fn();
		const onDraw = vi.fn();
		const onDrawEnd = vi.fn();
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceLayerUnderlay,
				viewport,
				viewportSize: { width: 100, height: 100 },
				isReferenceLayerActive: true,
				activeTool: 'eyedropper',
				onDrawStart,
				onDraw,
				onDrawEnd,
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
			clientX: 20,
			clientY: 20
		});
		await fireEvent.pointerUp(overlay, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 20,
			clientY: 20
		});

		expect(onDrawStart).toHaveBeenCalledWith(0, 'mouse');
		expect(onDraw).toHaveBeenNthCalledWith(1, { x: 0.7, y: 1.5 }, null);
		expect(onDraw).toHaveBeenNthCalledWith(2, { x: 1.7, y: 1.5 }, { x: 0.7, y: 1.5 });
		expect(onDrawEnd).toHaveBeenCalledTimes(1);
		expect(onReferencePlacementCommit).not.toHaveBeenCalled();
	});

	it('forwards canvas pointer cancel to the draw cancel lifecycle', async () => {
		const onDrawStart = vi.fn();
		const onDrawEnd = vi.fn();
		const onDrawCancel = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				viewport,
				viewportSize: { width: 100, height: 100 },
				onDrawStart,
				onDrawEnd,
				onDrawCancel
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
		await fireEvent.pointerCancel(canvas, {
			pointerId: 1,
			pointerType: 'mouse'
		});

		expect(onDrawStart).toHaveBeenCalledTimes(1);
		expect(onDrawCancel).toHaveBeenCalledTimes(1);
		expect(onDrawEnd).not.toHaveBeenCalled();
	});

	it('cancels active Floating Selection drawing on Escape and ignores the later pointer up', async () => {
		const onDrawStart = vi.fn();
		const onDrawEnd = vi.fn();
		const onDrawCancel = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				marquee: marqueeRegion(),
				floatingSelectionOffset: { dx: 1, dy: 1 },
				viewport,
				viewportSize: { width: 100, height: 100 },
				activeTool: 'selection',
				onDrawStart,
				onDrawEnd,
				onDrawCancel
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
		await fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
		await fireEvent.pointerUp(canvas, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 10,
			clientY: 10
		});

		expect(onDrawStart).toHaveBeenCalledTimes(1);
		expect(onDrawCancel).toHaveBeenCalledTimes(1);
		expect(onDrawEnd).not.toHaveBeenCalled();
	});

	it('does not cancel non-selection drawing on Escape', async () => {
		const onDrawStart = vi.fn();
		const onDrawEnd = vi.fn();
		const onDrawCancel = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				viewport,
				viewportSize: { width: 100, height: 100 },
				activeTool: 'pencil',
				onDrawStart,
				onDrawEnd,
				onDrawCancel
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
		await fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
		await fireEvent.pointerUp(canvas, {
			pointerId: 1,
			pointerType: 'mouse',
			button: 0,
			clientX: 10,
			clientY: 10
		});

		expect(onDrawStart).toHaveBeenCalledTimes(1);
		expect(onDrawCancel).not.toHaveBeenCalled();
		expect(onDrawEnd).toHaveBeenCalledTimes(1);
	});

	it('previews a body drag before committing the Reference placement', async () => {
		const onReferencePlacementCommit = vi.fn();
		render(PixelCanvasView, {
			props: {
				pixelCanvas,
				referenceLayerUnderlay,
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
				referenceLayerUnderlay: squareReferenceLayerUnderlay,
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
				referenceLayerUnderlay: largeSquareReferenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
			referenceLayerUnderlay,
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
				referenceLayerUnderlay,
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
