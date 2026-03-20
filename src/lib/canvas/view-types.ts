import type { WasmViewport } from '$wasm/dotorixel_wasm';

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
