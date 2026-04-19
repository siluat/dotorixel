import type { Color } from './color';

/**
 * The subset of tool types that map to WASM drawing algorithms.
 * Does not include floodfill, eyedropper, or move — those use separate APIs.
 */
export type DrawingToolType = 'pencil' | 'eraser' | 'line' | 'rectangle' | 'ellipse';

/**
 * Drawing operations that tools invoke.
 *
 * Most methods operate on the canvas captured in the closure at creation time
 * (via `createDrawingOps(getCanvas)`), so callers don't pass a canvas parameter —
 * this avoids type assertions between PixelCanvas and WasmPixelCanvas.
 */
export interface DrawingOps {
	/** Apply a single-pixel tool operation. Returns true if a pixel changed. */
	applyTool(x: number, y: number, tool: DrawingToolType, color: Color): boolean;

	/**
	 * Apply a stroke as a batch of pixels in order. The default implementation
	 * loops over the points and calls `applyTool`; decorators (e.g. pixel-perfect)
	 * can override this to filter or transform the batch as a whole.
	 *
	 * `pixels` is a flat coordinate array `[x0, y0, x1, y1, ...]` (typically the
	 * output of `interpolatePixels`). Returns true if any pixel changed.
	 */
	applyStroke(pixels: Int32Array, tool: DrawingToolType, color: Color): boolean;

	/**
	 * Write a single pixel of arbitrary color, regardless of tool kind. Used by
	 * decorators that need to revert or restore pixels (e.g. pixel-perfect filter).
	 * Out-of-bounds writes are silently dropped. Returns true if the pixel was set.
	 */
	setPixel(x: number, y: number, color: Color): boolean;

	/** Read the color at (x, y). Returns null if out of bounds. */
	getPixel(x: number, y: number): Color | null;

	/** Fill connected same-color region. Returns true if any pixel changed. */
	floodFill(x: number, y: number, color: Color): boolean;

	/** Bresenham interpolation between two points. Returns flat [x0,y0, x1,y1, ...]. */
	interpolatePixels(x0: number, y0: number, x1: number, y1: number): Int32Array;

	/** Rectangle outline coordinates. Returns flat [x0,y0, x1,y1, ...]. */
	rectangleOutline(x0: number, y0: number, x1: number, y1: number): Int32Array;

	/** Ellipse outline coordinates. Returns flat [x0,y0, x1,y1, ...]. */
	ellipseOutline(x0: number, y0: number, x1: number, y1: number): Int32Array;
}
