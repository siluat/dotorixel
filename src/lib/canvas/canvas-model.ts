import type { Color } from './color';

/** Continuous point in document canvas space. May contain fractional values. */
export interface CanvasPoint {
	readonly x: number;
	readonly y: number;
}

/** Discrete pixel position on the art canvas. */
export interface CanvasCoords extends CanvasPoint {}

/** Reference Layer source-to-document placement. */
export interface ReferencePlacement {
	readonly x: number;
	readonly y: number;
	readonly scale: number;
}

/** Document-scoped rectangular Marquee region in pixel coordinates. */
export interface MarqueeRegion {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	contains(x: number, y: number): boolean;
	translate(dx: number, dy: number): MarqueeRegion;
	clip_to(canvas_w: number, canvas_h: number): MarqueeRegion | undefined;
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
 * state. The `composite()` method returns a row-major RGBA buffer of visible
 * Pixel Layers blended bottom-to-top; Reference Layers are rendered separately
 * as viewport underlays.
 *
 * Structurally satisfied by WasmDocument. Method names are snake_case to
 * match the WASM bindings; the structural-compatibility check in
 * `wasm-sync.test.ts` enforces this contract at compile time.
 */
export interface Document {
	readonly width: number;
	readonly height: number;
	composite(): Uint8Array;
	/** Pixel-only composite for export and saved-work thumbnails. */
	composite_for_export(): Uint8Array;
	/** Reads the active-layer pixel at `(x, y)`. Throws when `(x, y)` is outside `width × height`. */
	get_pixel(x: number, y: number): Color;
	/** Reads the active layer for sampling, or returns `undefined` when no pixel is available. */
	try_get_pixel(x: number, y: number): Color | undefined;
	active_layer_id(): string;
	marquee(): MarqueeRegion | undefined;
	set_marquee(region: MarqueeRegion | null | undefined): void;
	next_layer_number(): number;
	is_timeline_panel_collapsed(): boolean;
	/**
	 * Sets whether the timeline (layers) panel is rendered in its collapsed
	 * mode. This is per-document UI state — persisted alongside the document
	 * but never pushed to undo history, since the choice is incidental to
	 * the artwork.
	 */
	set_timeline_panel_collapsed(collapsed: boolean): void;
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
	 * Sets the singleton Reference Layer with decoded source RGBA bytes. The
	 * core computes the initial auto-fit placement, keeps the Reference
	 * bottom-most, and makes it active.
	 */
	add_reference_layer(
		new_id: string,
		name: string,
		source_rgba: Uint8Array,
		source_width: number,
		source_height: number
	): void;
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
	 * Moves a Pixel Layer with `id` to `new_index` in the stack (0 = z-bottom).
	 * `new_index` is silently clamped to `[0, layer_count - 1]`, and cannot
	 * place Pixel Layers below a Reference Layer. Reference reorder attempts
	 * are no-ops. The active layer pointer is preserved across reordering —
	 * it's tracked by id, not by index. Throws if no layer with this id exists.
	 */
	reorder_layer(id: string, new_index: number): void;
	/**
	 * Updates a Reference Layer's placement. Throws when `id` does not exist
	 * or points at a Pixel Layer.
	 */
	set_reference_placement(id: string, x: number, y: number, scale: number): void;
	/**
	 * Sets the visibility flag of the layer with `id`. Throws if no layer
	 * with this id exists; previous visibility is preserved on error.
	 */
	set_layer_visibility(id: string, visible: boolean): void;
	/** Returns `"pixel"` or `"reference"`, or `undefined` when `index` is out of range. */
	layer_kind_at(index: number): string | undefined;
	/** Returns a Reference Layer's source RGBA buffer, or `undefined` for Pixel Layers / out of range. */
	layer_source_pixels_at(index: number): Uint8Array | undefined;
	/** Returns a stable source RGBA fingerprint, or `undefined` for Pixel Layers / out of range. */
	layer_source_fingerprint_at(index: number): string | undefined;
	/** Returns `[natural_width, natural_height]`, or `undefined` for Pixel Layers / out of range. */
	layer_source_dimensions_at(index: number): Uint32Array | undefined;
	/** Returns a Reference Layer's placement, or `undefined` for Pixel Layers / out of range. */
	layer_placement_at(index: number): ReferencePlacement | undefined;
}
