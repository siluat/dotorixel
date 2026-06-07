import type { CanvasCoords, CanvasPoint } from './canvas-model';

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
 * Display size of one canvas pixel in screen pixels, rounded to an integer to
 * keep `fillRect`/grid edges subpixel-aligned during continuous zoom.
 *
 * The single web-shell authority for this value: renderer, overlays, the
 * Reference underlay, and the Reference Layer Placement Interaction all derive
 * from it. Mirrors the Rust core's `Viewport::effective_pixel_size`; the web
 * keeps a pure-TS twin because the formula is trivial and routing every
 * render-loop query through WASM would allocate a `WasmViewport` per call.
 * `pixelSize` and `zoom` are always positive, so `Math.round` (half up) and
 * Rust's `f64::round` (half away from zero) agree.
 */
export function effectivePixelSize(vd: ViewportData): number {
	return Math.round(vd.pixelSize * vd.zoom);
}

/**
 * All viewport operations — camera transforms + zoom arithmetic.
 * Implemented by the WASM adapter; consumers import the singleton from wasm-backend.
 */
export interface ViewportOps {
	// Camera queries and transforms
	screenToCanvas(vd: ViewportData, screenX: number, screenY: number): CanvasCoords;
	/** Continuous document-space point for precise sampling and overlays. */
	screenToCanvasPoint(vd: ViewportData, screenX: number, screenY: number): CanvasPoint;
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
	clampPanToDocumentBounds(
		vd: ViewportData,
		minX: number,
		minY: number,
		maxX: number,
		maxY: number,
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
