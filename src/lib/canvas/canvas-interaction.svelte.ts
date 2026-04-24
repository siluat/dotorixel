import type { ViewportData } from './viewport';
import { viewportOps } from './wasm-backend';
import type { CanvasCoords } from './canvas-model';

const MIN_PINCH_DISTANCE = 10;
const LONG_PRESS_DELAY = 400;

export type InteractionType = 'idle' | 'drawing' | 'panning' | 'pinching' | 'sampling';

/**
 * The W3C Pointer Events `pointerType` values we care about. The spec also
 * allows an empty string for unknown devices; `normalizePointerType` collapses
 * that (and any other unexpected value) to `'mouse'` at the boundary so the
 * rest of the app can rely on a closed union.
 */
export type PointerType = 'mouse' | 'pen' | 'touch';

export function normalizePointerType(raw: string): PointerType {
	return raw === 'pen' || raw === 'touch' ? raw : 'mouse';
}

type InteractionMode =
	| { readonly type: 'idle' }
	| {
			type: 'drawing';
			lastPixel: CanvasCoords | null;
			pendingCoords: CanvasCoords | null;
			button: number;
			pointerType: PointerType;
		}
	| { type: 'panning'; startX: number; startY: number }
	| {
			type: 'pinching';
			initialViewport: ViewportData;
			initialDistance: number;
			initialMidX: number;
			initialMidY: number;
		}
	| { readonly type: 'sampling' };

export interface CanvasInteractionOptions {
	screenToCanvas: (localX: number, localY: number) => CanvasCoords;
	getViewport: () => ViewportData;
	isSpaceHeld: () => boolean;
}

export interface CanvasInteractionCallbacks {
	/**
	 * `pointerType` is plumbed through so downstream tools (e.g. eyedropper
	 * loupe) can pick the right offset preset for the current input source.
	 */
	onDrawStart: (button: number, pointerType: PointerType) => void;
	onDraw: (current: CanvasCoords, previous: CanvasCoords | null) => void;
	onDrawEnd: () => void;
	onViewportChange: (viewport: ViewportData) => void;
	/**
	 * Called when a color-sampling session should open (400ms touch long-press).
	 * Returning `true` transitions the interaction into `'sampling'`, suppressing
	 * further draw callbacks until the pointer lifts. Returning `false` leaves
	 * the pending touch draw intact — used to short-circuit when the active
	 * tool already drives sampling through the normal drawing flow.
	 */
	onSampleStart: (coords: CanvasCoords, button: number, pointerType: PointerType) => boolean;
	onSampleUpdate: (coords: CanvasCoords) => void;
	/** Called when the pointer lifts cleanly over the canvas — commit the picked color. */
	onSampleEnd: () => void;
	/**
	 * Called when sampling is interrupted before a clean release (pinch transition,
	 * pointer leaving the canvas, window blur). Must not commit a color — the user
	 * never confirmed the pick.
	 */
	onSampleCancel: () => void;
}

export interface CanvasInteraction {
	pointerDown(id: number, x: number, y: number, pointerType: PointerType, button: number): void;
	pointerMove(x: number, y: number): void;
	windowPointerMove(id: number, x: number, y: number, buttons: number): void;
	pointerUp(id: number, x: number, y: number): void;
	pointerLeave(x: number, y: number): void;
	blur(): void;
	readonly interactionType: InteractionType;
}

export function createCanvasInteraction(
	options: CanvasInteractionOptions,
	callbacks: CanvasInteractionCallbacks
): CanvasInteraction {
	let interaction = $state<InteractionMode>({ type: 'idle' });
	const activePointers = new Map<number, { x: number; y: number; pointerType: PointerType }>();
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;

	function startLongPressTimer(coords: CanvasCoords, button: number): void {
		clearLongPressTimer();
		longPressTimer = setTimeout(() => {
			longPressTimer = null;
			if (interaction.type === 'drawing' && interaction.pendingCoords !== null) {
				const pointerType = interaction.pointerType;
				if (callbacks.onSampleStart(coords, button, pointerType)) {
					interaction = { type: 'sampling' };
				}
			}
		}, LONG_PRESS_DELAY);
	}

	function clearLongPressTimer(): void {
		if (longPressTimer !== null) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	function drawAt(coords: CanvasCoords): void {
		if (interaction.type !== 'drawing') return;
		const lastPixel = interaction.lastPixel;
		if (lastPixel && coords.x === lastPixel.x && coords.y === lastPixel.y) return;
		interaction.lastPixel = coords;
		callbacks.onDraw(coords, lastPixel);
	}

	function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
		const dx = a.x - b.x;
		const dy = a.y - b.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	function pointerMidpoint(
		a: { x: number; y: number },
		b: { x: number; y: number }
	): { x: number; y: number } {
		return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	}

	function getTwoTouchPointers(): [{ x: number; y: number }, { x: number; y: number }] | null {
		const touches: { x: number; y: number }[] = [];
		for (const p of activePointers.values()) {
			if (p.pointerType === 'touch') {
				touches.push(p);
				if (touches.length === 2) return [touches[0], touches[1]];
			}
		}
		return null;
	}

	function tryEnterPinching(): boolean {
		if (interaction.type === 'pinching') return true;
		const points = getTwoTouchPointers();
		if (!points) return false;
		const [a, b] = points;
		const distance = pointerDistance(a, b);
		if (distance < MIN_PINCH_DISTANCE) return false;
		const mid = pointerMidpoint(a, b);
		interaction = {
			type: 'pinching',
			initialViewport: options.getViewport(),
			initialDistance: distance,
			initialMidX: mid.x,
			initialMidY: mid.y
		};
		return true;
	}

	function commitPending(): void {
		if (interaction.type !== 'drawing' || interaction.pendingCoords === null) return;
		callbacks.onDrawStart(interaction.button, interaction.pointerType);
		drawAt(interaction.pendingCoords);
		interaction.pendingCoords = null;
	}

	return {
		pointerDown(
			id: number,
			x: number,
			y: number,
			pointerType: PointerType,
			button: number
		): void {
			activePointers.set(id, { x, y, pointerType });

			if (getTwoTouchPointers() !== null) {
				clearLongPressTimer();
				if (interaction.type === 'drawing') {
					if (interaction.pendingCoords === null) {
						callbacks.onDrawEnd();
					}
					interaction = { type: 'idle' };
				} else if (interaction.type === 'sampling') {
					callbacks.onSampleCancel();
					interaction = { type: 'idle' };
				}
				tryEnterPinching();
				return;
			}

			if (interaction.type !== 'idle') return;

			const isMiddleClick = button === 1;
			const isDrawButton = button === 0 || button === 2;

			if (isMiddleClick) {
				interaction = { type: 'panning', startX: x, startY: y };
				return;
			}

			if (!isDrawButton) return;

			if (options.isSpaceHeld()) {
				interaction = { type: 'panning', startX: x, startY: y };
				return;
			}

			if (pointerType === 'touch') {
				const pendingCoords = options.screenToCanvas(x, y);
				interaction = {
					type: 'drawing',
					lastPixel: null,
					pendingCoords,
					button,
					pointerType
				};
				startLongPressTimer(pendingCoords, button);
				return;
			}

			interaction = {
				type: 'drawing',
				lastPixel: null,
				pendingCoords: null,
				button,
				pointerType
			};
			callbacks.onDrawStart(button, pointerType);
			drawAt(options.screenToCanvas(x, y));
		},

		pointerMove(x: number, y: number): void {
			if (interaction.type === 'sampling') {
				callbacks.onSampleUpdate(options.screenToCanvas(x, y));
				return;
			}
			if (interaction.type !== 'drawing') return;
			clearLongPressTimer();
			commitPending();
			drawAt(options.screenToCanvas(x, y));
		},

		windowPointerMove(id: number, x: number, y: number, buttons: number): void {
			if (activePointers.has(id)) {
				const p = activePointers.get(id)!;
				p.x = x;
				p.y = y;
			}

			// Deferred pinch entry: 2 touch pointers down but not yet pinching
			if (getTwoTouchPointers() !== null && interaction.type !== 'pinching') {
				if (tryEnterPinching()) return;
			}

			if (interaction.type === 'pinching') {
				const points = getTwoTouchPointers();
				if (!points) return;
				const [a, b] = points;

				const currentDistance = pointerDistance(a, b);
				const currentMid = pointerMidpoint(a, b);

				const newZoom = viewportOps.clampZoom(
					interaction.initialViewport.zoom * (currentDistance / interaction.initialDistance)
				);
				const zoomed = viewportOps.zoomAtPoint(
					interaction.initialViewport,
					interaction.initialMidX,
					interaction.initialMidY,
					newZoom
				);
				const panned = viewportOps.pan(
					zoomed,
					currentMid.x - interaction.initialMidX,
					currentMid.y - interaction.initialMidY
				);
				callbacks.onViewportChange(panned);
				return;
			}

			if (interaction.type === 'panning') {
				if (buttons === 0) {
					interaction = { type: 'idle' };
					return;
				}
				const deltaX = x - interaction.startX;
				const deltaY = y - interaction.startY;
				interaction.startX = x;
				interaction.startY = y;
				callbacks.onViewportChange(viewportOps.pan(options.getViewport(), deltaX, deltaY));
			}
		},

		pointerUp(id: number, x: number, y: number): void {
			clearLongPressTimer();
			activePointers.delete(id);

			if (interaction.type === 'sampling') {
				callbacks.onSampleEnd();
				interaction = { type: 'idle' };
				return;
			}

			if (interaction.type === 'pinching') {
				interaction = { type: 'idle' };
				return;
			}

			if (interaction.type === 'drawing') {
				if (interaction.pendingCoords !== null) {
					// Touch tap: commit the deferred pixel
					callbacks.onDrawStart(interaction.button, interaction.pointerType);
					drawAt(options.screenToCanvas(x, y));
				}
				callbacks.onDrawEnd();
			}
			interaction = { type: 'idle' };
		},

		pointerLeave(x: number, y: number): void {
			clearLongPressTimer();
			if (interaction.type === 'pinching') return;

			if (interaction.type === 'sampling') {
				callbacks.onSampleCancel();
				interaction = { type: 'idle' };
				return;
			}

			if (interaction.type === 'drawing') {
				if (interaction.pendingCoords !== null) {
					// Touch drawing never started — discard
					interaction = { type: 'idle' };
					return;
				}
				drawAt(options.screenToCanvas(x, y));
				callbacks.onDrawEnd();
				interaction = { type: 'idle' };
			}
		},

		blur(): void {
			clearLongPressTimer();
			activePointers.clear();
			if (interaction.type === 'sampling') {
				callbacks.onSampleCancel();
			} else if (interaction.type === 'drawing' && interaction.pendingCoords === null) {
				callbacks.onDrawEnd();
			}
			interaction = { type: 'idle' };
		},

		get interactionType(): InteractionType {
			return interaction.type;
		}
	};
}
