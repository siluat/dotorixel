import type { Color } from './color';
import type { PixelCanvas } from './pixel-canvas';
import type { ResizeAnchor } from './view-types';

/** Static operations for creating and transforming PixelCanvas instances. */
export interface CanvasFactory {
	create(width: number, height: number): PixelCanvas;
	fromPixels(width: number, height: number, pixels: Uint8Array): PixelCanvas;
	withColor(width: number, height: number, color: Color): PixelCanvas;
	resizeWithAnchor(
		canvas: PixelCanvas,
		newWidth: number,
		newHeight: number,
		anchor: ResizeAnchor
	): PixelCanvas;

	readonly minDimension: number;
	readonly maxDimension: number;
	isValidDimension(value: number): boolean;
	presets(): number[];
}
