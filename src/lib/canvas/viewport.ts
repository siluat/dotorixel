import type { CanvasCoords } from './canvas-types';

export interface ViewportSize {
	readonly width: number;
	readonly height: number;
}

/**
 * Immutable camera state — zoom, pan, coordinate mapping.
 * Every mutation method returns a new instance.
 *
 * Structurally satisfied by WasmViewport — no wrapping needed at runtime.
 */
export interface Viewport {
	readonly pixel_size: number;
	readonly zoom: number;
	readonly pan_x: number;
	readonly pan_y: number;

	effective_pixel_size(): number;
	screen_to_canvas(screen_x: number, screen_y: number): CanvasCoords;
	display_size(canvas_width: number, canvas_height: number): ViewportSize;

	zoom_at_point(screen_x: number, screen_y: number, new_zoom: number): Viewport;
	pan(delta_x: number, delta_y: number): Viewport;
	clamp_pan(
		canvas_width: number,
		canvas_height: number,
		viewport_width: number,
		viewport_height: number
	): Viewport;
	fit_to_viewport(
		canvas_width: number,
		canvas_height: number,
		viewport_width: number,
		viewport_height: number,
		max_zoom: number
	): Viewport;
}

/** Zoom arithmetic and viewport constants. Pure functions — no Viewport instances created. */
export interface ViewportOps {
	clampZoom(zoom: number): number;
	computePinchZoom(currentZoom: number, deltaY: number): number;
	nextZoomLevel(currentZoom: number): number;
	prevZoomLevel(currentZoom: number): number;
	defaultPixelSize(canvasWidth: number, canvasHeight: number): number;
	zoomLevels(): number[];
	readonly minZoom: number;
	readonly maxZoom: number;
}

/** Creates Viewport instances. */
export interface ViewportFactory {
	create(pixelSize: number, zoom: number, panX: number, panY: number): Viewport;
	forCanvas(canvasWidth: number, canvasHeight: number): Viewport;
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

/**
 * Reconstructs a ViewportState from serialized data.
 * Requires a ViewportFactory so this module has no WASM dependency.
 */
export function restoreViewportState(
	data: ViewportData,
	factory: ViewportFactory
): ViewportState {
	return {
		viewport: factory.create(data.pixelSize, data.zoom, data.panX, data.panY),
		showGrid: data.showGrid,
		gridColor: data.gridColor
	};
}
