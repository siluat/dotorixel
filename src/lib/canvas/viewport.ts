import type { CanvasCoords } from './canvas-types';

export interface ViewportSize {
	readonly width: number;
	readonly height: number;
}

/**
 * Plain-object representation of full viewport state.
 * The single viewport type — used for state, rendering, and persistence.
 */
export interface ViewportData {
	readonly pixelSize: number;
	readonly zoom: number;
	readonly panX: number;
	readonly panY: number;
	readonly showGrid: boolean;
	readonly gridColor: string;
}

/**
 * All viewport operations — camera transforms + zoom arithmetic.
 * Implemented by the WASM adapter; consumers import the singleton from wasm-backend.
 */
export interface ViewportOps {
	// Camera transforms (each returns a new ViewportData)
	screenToCanvas(vd: ViewportData, screenX: number, screenY: number): CanvasCoords;
	zoomAtPoint(
		vd: ViewportData,
		screenX: number,
		screenY: number,
		newZoom: number
	): ViewportData;
	pan(vd: ViewportData, deltaX: number, deltaY: number): ViewportData;
	clampPan(
		vd: ViewportData,
		canvasWidth: number,
		canvasHeight: number,
		viewportWidth: number,
		viewportHeight: number
	): ViewportData;
	fitToViewport(
		vd: ViewportData,
		canvasWidth: number,
		canvasHeight: number,
		viewportWidth: number,
		viewportHeight: number,
		maxZoom: number
	): ViewportData;
	effectivePixelSize(vd: ViewportData): number;
	displaySize(
		vd: ViewportData,
		canvasWidth: number,
		canvasHeight: number
	): ViewportSize;
	forCanvas(canvasWidth: number, canvasHeight: number): ViewportData;

	// Zoom arithmetic
	clampZoom(zoom: number): number;
	computePinchZoom(currentZoom: number, deltaY: number): number;
	nextZoomLevel(currentZoom: number): number;
	prevZoomLevel(currentZoom: number): number;
	defaultPixelSize(canvasWidth: number, canvasHeight: number): number;
	zoomLevels(): number[];
	readonly minZoom: number;
	readonly maxZoom: number;
}
