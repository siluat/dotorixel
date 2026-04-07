import type { Viewport } from './viewport';

/** Creates Viewport instances. */
export interface ViewportFactory {
	create(pixelSize: number, zoom: number, panX: number, panY: number): Viewport;
	forCanvas(canvasWidth: number, canvasHeight: number): Viewport;
}
