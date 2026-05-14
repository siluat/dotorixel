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
	 * Overwrites the active layer's pixel buffer with `data`. Used by tools
	 * that take a stroke-start snapshot and restore it during preview (shape
	 * tools, move tool). Other layers are unaffected. Throws when `data.length`
	 * is not exactly `width * height * 4`.
	 */
	restore_active_layer_pixels(data: Uint8Array): void;
	/**
	 * Appends a new transparent layer with the given UUID and display name.
	 * The new layer becomes active; `next_layer_number` is incremented (the
	 * counter is monotonic — never reused after delete). Throws if the id is
	 * not a valid UUID, or already exists in the document.
	 */
	add_layer(new_id: string, name: string): void;
	/**
	 * Removes the layer with `id`. Throws when the layer does not exist or
	 * when removing it would empty the document (a document must always
	 * contain at least one layer). When the removed layer was active, the
	 * active pointer moves to an adjacent layer.
	 */
	remove_layer(id: string): void;
	/**
	 * Sets the active layer pointer by id. Throws if no layer with this id
	 * exists; the previous active layer is preserved on error.
	 */
	set_active_layer(id: string): void;
	/**
	 * Moves the layer with `id` to `new_index` in the stack (0 = z-bottom).
	 * `new_index` is silently clamped to `[0, layer_count - 1]`. The active
	 * layer pointer is preserved across reordering — it's tracked by id, not
	 * by index. Throws if no layer with this id exists.
	 */
	reorder_layer(id: string, new_index: number): void;
	/**
	 * Sets the visibility flag of the layer with `id`. Throws if no layer
	 * with this id exists; previous visibility is preserved on error.
	 */
	set_layer_visibility(id: string, visible: boolean): void;
}
