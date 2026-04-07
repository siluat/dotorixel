import type { Viewport } from './viewport';
import { viewportFactory } from './wasm-backend';

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
	readonly viewport: Viewport;
	readonly showGrid: boolean;
	readonly gridColor: string;
}

/**
 * Plain-object representation of full viewport state.
 * Replaces ViewportRecord, ViewportInit, and RenderViewport —
 * the single serializable shape for persistence, rendering, and restore.
 */
export interface ViewportData {
	readonly pixelSize: number;
	readonly zoom: number;
	readonly panX: number;
	readonly panY: number;
	readonly showGrid: boolean;
	readonly gridColor: string;
}

export function extractViewportData(state: ViewportState): ViewportData {
	return {
		pixelSize: state.viewport.pixel_size,
		zoom: state.viewport.zoom,
		panX: state.viewport.pan_x,
		panY: state.viewport.pan_y,
		showGrid: state.showGrid,
		gridColor: state.gridColor
	};
}

export function restoreViewportState(data: ViewportData): ViewportState {
	return {
		viewport: viewportFactory.create(data.pixelSize, data.zoom, data.panX, data.panY),
		showGrid: data.showGrid,
		gridColor: data.gridColor
	};
}
