import type { WasmViewport } from '$wasm/dotorixel_wasm';
import type { CanvasCoords } from './view-types';

export type InteractionType = 'idle' | 'drawing' | 'panning';

type InteractionMode =
	| { readonly type: 'idle' }
	| { type: 'drawing'; lastPixel: CanvasCoords | null }
	| { type: 'panning'; startX: number; startY: number };

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
	pointerDown(x: number, y: number, button: number): void;
	pointerMove(x: number, y: number): void;
	windowPointerMove(x: number, y: number, buttons: number): void;
	pointerUp(): void;
	pointerLeave(x: number, y: number): void;
	blur(): void;
	readonly interactionType: InteractionType;
}

export function createCanvasInteraction(
	options: CanvasInteractionOptions,
	callbacks: CanvasInteractionCallbacks
): CanvasInteraction {
	let interaction = $state<InteractionMode>({ type: 'idle' });

	function drawAt(coords: CanvasCoords): void {
		if (interaction.type !== 'drawing') return;
		const lastPixel = interaction.lastPixel;
		if (lastPixel && coords.x === lastPixel.x && coords.y === lastPixel.y) return;
		interaction.lastPixel = coords;
		callbacks.onDraw(coords, lastPixel);
	}

	return {
		pointerDown(x: number, y: number, button: number): void {
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

			interaction = { type: 'drawing', lastPixel: null };
			callbacks.onDrawStart();
			drawAt(options.screenToCanvas(x, y));
		},

		pointerMove(x: number, y: number): void {
			if (interaction.type !== 'drawing') return;
			drawAt(options.screenToCanvas(x, y));
		},

		windowPointerMove(x: number, y: number, buttons: number): void {
			if (interaction.type !== 'panning') return;
			if (buttons === 0) {
				interaction = { type: 'idle' };
				return;
			}
			const deltaX = x - interaction.startX;
			const deltaY = y - interaction.startY;
			interaction.startX = x;
			interaction.startY = y;
			callbacks.onViewportChange(options.getViewport().pan(deltaX, deltaY));
		},

		pointerUp(): void {
			if (interaction.type === 'drawing') {
				callbacks.onDrawEnd();
			}
			interaction = { type: 'idle' };
		},

		pointerLeave(x: number, y: number): void {
			if (interaction.type === 'drawing') {
				drawAt(options.screenToCanvas(x, y));
				callbacks.onDrawEnd();
				interaction = { type: 'idle' };
			}
		},

		blur(): void {
			if (interaction.type === 'drawing') {
				callbacks.onDrawEnd();
			}
			interaction = { type: 'idle' };
		},

		get interactionType(): InteractionType {
			return interaction.type;
		}
	};
}
