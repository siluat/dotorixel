import { WasmViewport } from '$wasm/dotorixel_wasm';
import type { CanvasCoords } from './view-types';

const MIN_PINCH_DISTANCE = 10;

export type InteractionType = 'idle' | 'drawing' | 'panning' | 'pinching';

type InteractionMode =
	| { readonly type: 'idle' }
	| { type: 'drawing'; lastPixel: CanvasCoords | null; pendingCoords: CanvasCoords | null }
	| { type: 'panning'; startX: number; startY: number }
	| {
			type: 'pinching';
			initialViewport: WasmViewport;
			initialDistance: number;
			initialMidX: number;
			initialMidY: number;
		};

export interface CanvasInteractionOptions {
	screenToCanvas: (localX: number, localY: number) => CanvasCoords;
	getViewport: () => WasmViewport;
	isSpaceHeld: () => boolean;
}

export interface CanvasInteractionCallbacks {
	onDrawStart: () => void;
	onDraw: (current: CanvasCoords, previous: CanvasCoords | null) => void;
	onDrawEnd: () => void;
	onViewportChange: (viewport: WasmViewport) => void;
}

export interface CanvasInteraction {
	pointerDown(id: number, x: number, y: number, pointerType: string, button: number): void;
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
	const activePointers = new Map<number, { x: number; y: number }>();

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

	function getTwoPointers(): [{ x: number; y: number }, { x: number; y: number }] | null {
		if (activePointers.size < 2) return null;
		const iter = activePointers.values();
		return [iter.next().value!, iter.next().value!];
	}

	function tryEnterPinching(): boolean {
		if (interaction.type === 'pinching') return true;
		const points = getTwoPointers();
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
		callbacks.onDrawStart();
		drawAt(interaction.pendingCoords);
		interaction.pendingCoords = null;
	}

	return {
		pointerDown(
			id: number,
			x: number,
			y: number,
			pointerType: string,
			button: number
		): void {
			activePointers.set(id, { x, y });

			if (activePointers.size >= 2) {
				if (interaction.type === 'drawing') {
					if (interaction.pendingCoords === null) {
						callbacks.onDrawEnd();
					}
					interaction = { type: 'idle' };
				}
				tryEnterPinching();
				return;
			}

			if (interaction.type !== 'idle') return;

			const isMiddleClick = button === 1;
			const isLeftClick = button === 0;

			if (isMiddleClick) {
				interaction = { type: 'panning', startX: x, startY: y };
				return;
			}

			if (!isLeftClick) return;

			if (options.isSpaceHeld()) {
				interaction = { type: 'panning', startX: x, startY: y };
				return;
			}

			if (pointerType === 'touch') {
				interaction = {
					type: 'drawing',
					lastPixel: null,
					pendingCoords: options.screenToCanvas(x, y)
				};
				return;
			}

			interaction = { type: 'drawing', lastPixel: null, pendingCoords: null };
			callbacks.onDrawStart();
			drawAt(options.screenToCanvas(x, y));
		},

		pointerMove(x: number, y: number): void {
			if (interaction.type !== 'drawing') return;
			commitPending();
			drawAt(options.screenToCanvas(x, y));
		},

		windowPointerMove(id: number, x: number, y: number, buttons: number): void {
			if (activePointers.has(id)) {
				activePointers.set(id, { x, y });
			}

			// Deferred pinch entry: 2 pointers down but not yet pinching
			if (activePointers.size >= 2 && interaction.type !== 'pinching') {
				if (tryEnterPinching()) return;
			}

			if (interaction.type === 'pinching') {
				const points = getTwoPointers();
				if (!points) return;
				const [a, b] = points;

				const currentDistance = pointerDistance(a, b);
				const currentMid = pointerMidpoint(a, b);

				const newZoom = WasmViewport.clamp_zoom(
					interaction.initialViewport.zoom * (currentDistance / interaction.initialDistance)
				);
				const zoomed = interaction.initialViewport.zoom_at_point(
					interaction.initialMidX,
					interaction.initialMidY,
					newZoom
				);
				const panned = zoomed.pan(
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
				callbacks.onViewportChange(options.getViewport().pan(deltaX, deltaY));
			}
		},

		pointerUp(id: number, x: number, y: number): void {
			activePointers.delete(id);

			if (interaction.type === 'pinching') {
				interaction = { type: 'idle' };
				return;
			}

			if (interaction.type === 'drawing') {
				if (interaction.pendingCoords !== null) {
					// Touch tap: commit the deferred pixel
					callbacks.onDrawStart();
					drawAt(options.screenToCanvas(x, y));
				}
				callbacks.onDrawEnd();
			}
			interaction = { type: 'idle' };
		},

		pointerLeave(x: number, y: number): void {
			if (interaction.type === 'pinching') return;

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
			activePointers.clear();
			if (interaction.type === 'drawing' && interaction.pendingCoords === null) {
				callbacks.onDrawEnd();
			}
			interaction = { type: 'idle' };
		},

		get interactionType(): InteractionType {
			return interaction.type;
		}
	};
}
