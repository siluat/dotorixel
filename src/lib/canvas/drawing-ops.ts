import type { Color } from './color';

/**
 * The subset of tool types that map to WASM drawing algorithms.
 * Does not include floodfill, eyedropper, or move — those use separate APIs.
 */
export type DrawingToolType = 'pencil' | 'eraser' | 'line' | 'rectangle' | 'ellipse';

/**
 * Drawing operations that tools invoke.
 *
 * `applyTool` and `floodFill` operate on the canvas captured in the closure
 * at creation time (via `createDrawingOps(getCanvas)`), so callers don't pass
 * a canvas parameter — this avoids type assertions between PixelCanvas and WasmPixelCanvas.
 */
export interface DrawingOps {
	/** Apply a single-pixel tool operation. Returns true if a pixel changed. */
	applyTool(x: number, y: number, tool: DrawingToolType, color: Color): boolean;

	/** Fill connected same-color region. Returns true if any pixel changed. */
	floodFill(x: number, y: number, color: Color): boolean;

	/** Bresenham interpolation between two points. Returns flat [x0,y0, x1,y1, ...]. */
	interpolatePixels(x0: number, y0: number, x1: number, y1: number): Int32Array;

	/** Rectangle outline coordinates. Returns flat [x0,y0, x1,y1, ...]. */
	rectangleOutline(x0: number, y0: number, x1: number, y1: number): Int32Array;

	/** Ellipse outline coordinates. Returns flat [x0,y0, x1,y1, ...]. */
	ellipseOutline(x0: number, y0: number, x1: number, y1: number): Int32Array;
}
