import type { WasmViewport } from '$wasm/dotorixel_wasm';

export type ResizeAnchor =
	| 'top-left'
	| 'top-center'
	| 'top-right'
	| 'middle-left'
	| 'center'
	| 'middle-right'
	| 'bottom-left'
	| 'bottom-center'
	| 'bottom-right';

export interface CanvasCoords {
	readonly x: number;
	readonly y: number;
}

export interface ViewportSize {
	readonly width: number;
	readonly height: number;
}

export interface ViewportState {
	readonly viewport: WasmViewport;
	readonly showGrid: boolean;
	readonly gridColor: string;
}
