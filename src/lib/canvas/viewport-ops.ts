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
