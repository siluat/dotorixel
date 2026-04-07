import type { Color } from './color';

/**
 * 2D raster canvas: read pixel data, bounds checking, and serialization.
 *
 * Structurally satisfied by WasmPixelCanvas — no wrapping needed at runtime.
 * `set_pixel` and `resize_with_anchor` are intentionally excluded:
 * all pixel mutations go through DrawingOps, and resize_with_anchor is on CanvasFactory.
 */
export interface PixelCanvas {
	readonly width: number;
	readonly height: number;
	pixels(): Uint8Array;
	get_pixel(x: number, y: number): Color;
	restore_pixels(data: Uint8Array): void;
	is_inside_bounds(x: number, y: number): boolean;
	clear(): void;
	encode_png(): Uint8Array;
	resize(new_width: number, new_height: number): PixelCanvas;
}

/** Immutable pixel snapshot returned by undo/redo. */
export interface Snapshot {
	readonly width: number;
	readonly height: number;
	pixels(): Uint8Array;
}
