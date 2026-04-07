import type { Viewport } from './viewport';

/** Static operations for creating Viewport instances and zoom arithmetic. */
export interface ViewportFactory {
	create(pixelSize: number, zoom: number, panX: number, panY: number): Viewport;
	forCanvas(canvasWidth: number, canvasHeight: number): Viewport;

	clampZoom(zoom: number): number;
	computePinchZoom(currentZoom: number, deltaY: number): number;
	nextZoomLevel(currentZoom: number): number;
	prevZoomLevel(currentZoom: number): number;
	defaultPixelSize(canvasWidth: number, canvasHeight: number): number;
	zoomLevels(): number[];
	readonly minZoom: number;
	readonly maxZoom: number;
}
