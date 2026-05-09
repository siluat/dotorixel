import type { Color } from './color';

/** Discrete pixel position on the art canvas. */
export interface CanvasCoords {
	readonly x: number;
	readonly y: number;
}

/** Anchor point for canvas resize operations. */
export type ResizeAnchor =
	| 'top-left'
	| 'top-center'
	| 'top-right'
	| 'middle-left'
	| 'center'
	| 'middle-right'
	| 'bottom-left'
	| 'bottom-center'
	| 'bottom-right';

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
	encode_svg(): string;
	resize(new_width: number, new_height: number): PixelCanvas;
}

/**
 * Document with a stack of layers, an active-layer pointer, and presentation
 * state. The `composite()` method returns a row-major RGBA buffer of all
 * visible layers blended bottom-to-top.
 *
 * Structurally satisfied by WasmDocument. Method names are snake_case to
 * match the WASM bindings; the structural-compatibility check in
 * `wasm-sync.test.ts` enforces this contract at compile time.
 */
export interface Document {
	readonly width: number;
	readonly height: number;
	composite(): Uint8Array;
	/** Reads the active-layer pixel at `(x, y)`. Throws when `(x, y)` is outside `width × height`. */
	get_pixel(x: number, y: number): Color;
	active_layer_id(): string;
	next_layer_number(): number;
	is_timeline_panel_collapsed(): boolean;
	layer_count(): number;
	layer_id_at(index: number): string | undefined;
	layer_name_at(index: number): string | undefined;
	layer_visible_at(index: number): boolean | undefined;
	layer_opacity_at(index: number): number | undefined;
	layer_pixels_at(index: number): Uint8Array | undefined;
	/**
	 * Appends a new transparent layer with the given UUID and display name.
	 * The new layer becomes active; `next_layer_number` is incremented (the
	 * counter is monotonic — never reused after delete). Throws if the id is
	 * not a valid UUID, or already exists in the document.
	 */
	add_layer(new_id: string, name: string): void;
}
