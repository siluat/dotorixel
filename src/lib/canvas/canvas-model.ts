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
	/**
	 * Number of 90° clockwise turns applied to the source image, in `0..=3`.
	 * Optional for backward compatibility; absence is treated as 0 (no rotation).
	 */
	readonly rotation?: number;
}

/**
 * A Reference Layer's projected axis-aligned bounding box on the document
 * canvas, in canvas-pixel coordinates (min/max corners). The single producer is
 * the core's `ReferencePlacement::footprint`, read across the WASM seam via
 * {@link Document.reference_layer_footprint_at}; field names are snake_case to
 * match the binding, like {@link LayerMetadata}'s `placement`.
 */
export interface ReferenceFootprint {
	readonly min_x: number;
	readonly min_y: number;
	readonly max_x: number;
	readonly max_y: number;
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

/** Workspace-shared clipboard snapshot captured from a Marquee region. */
export interface SelectionClipboardData {
	readonly pixels: Uint8Array;
	readonly width: number;
	readonly height: number;
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
 * One layer's metadata as read across the WASM seam in a single
 * `layers_metadata()` crossing. The common fields are always present; the
 * Reference-only fields (`source_fingerprint`, `natural_width`,
 * `natural_height`, `placement`) are populated only for Reference Layers and
 * `undefined` for Pixel Layers. Bulk pixel buffers are excluded — fetch them on
 * demand via `layer_pixels_at` / `layer_source_pixels_at`.
 *
 * Field names are snake_case to match the WASM binding; consumers map them into
 * their shell-facing read models.
 */
export interface LayerMetadata {
	readonly id: string;
	readonly name: string;
	readonly visible: boolean;
	readonly opacity: number;
	/** `"pixel"` or `"reference"`. */
	readonly kind: string;
	readonly source_fingerprint: string | undefined;
	readonly natural_width: number | undefined;
	readonly natural_height: number | undefined;
	readonly placement: ReferencePlacement | undefined;
}

/**
 * One frame's metadata as read across the WASM seam in a single
 * `frames_metadata()` crossing. Carries the frame's `id` (its identity — the
 * 1-based ordinal a panel displays is positional) and its display `duration_ms`
 * (playback timing). The struct mirrors {@link LayerMetadata} and leaves room
 * for further per-frame attributes without reshaping the read.
 */
export interface FrameMetadata {
	readonly id: string;
	/** Display time in milliseconds during playback. */
	readonly duration_ms: number;
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
	/**
	 * Pixel-only composite of the frame identified by `frameId`, without moving
	 * the active-frame pointer — the read-only, frame-addressed sibling of
	 * {@link composite} that playback reads frame by frame. Throws when `frameId`
	 * is not a valid UUID or no frame with that id is on the axis.
	 */
	composite_at(frameId: string): Uint8Array;
	/**
	 * Pixel-only composite of the active frame with a transient
	 * `patchWidth × patchHeight` RGBA patch source-over'd onto the layer
	 * identified by `layerId` (top-left at `(destX, destY)`, clipped to the
	 * canvas) before that layer is blended at its opacity — the core entry the
	 * Floating Selection preview renders through. Throws when `layerId` is not a
	 * valid UUID or names no layer, when `patch.length` is not
	 * `patchWidth * patchHeight * 4`, or when the target is a Reference Layer.
	 */
	composite_with_layer_patch(
		layerId: string,
		patch: Uint8Array,
		patchWidth: number,
		patchHeight: number,
		destX: number,
		destY: number
	): Uint8Array;
	/** Reads the active-layer pixel at `(x, y)`. Throws when `(x, y)` is outside `width × height`. */
	get_pixel(x: number, y: number): Color;
	/** Reads the active layer for sampling, or returns `undefined` when no pixel is available. */
	try_get_pixel(x: number, y: number): Color | undefined;
	active_layer_id(): string;
	marquee(): MarqueeRegion | undefined;
	set_marquee(region: MarqueeRegion | null | undefined): void;
	/**
	 * Returns the current Marquee's active-layer pixels as row-major RGBA bytes.
	 * The result is empty when no Marquee exists or no pixel data is available.
	 */
	lift_marquee_pixels(): Uint8Array;
	/**
	 * Clears active-layer pixels inside the current Marquee. No-op when no
	 * Marquee exists or no pixel data is available.
	 */
	clear_marquee_pixels(): void;
	/**
	 * Mirrors the current Marquee region on the active Pixel Layer's
	 * active-frame cel horizontally; the Marquee position is preserved. The
	 * Document's dimensions, other layers, other frames, and the Reference
	 * Layer are untouched. No-op without a Marquee or on a Reference Layer.
	 */
	flip_marquee_horizontal(): void;
	/** Mirrors the current Marquee region vertically. Mirror of {@link flip_marquee_horizontal}. */
	flip_marquee_vertical(): void;
	/**
	 * Mirrors the whole canvas horizontally: every Pixel Layer's every cel
	 * (all frames) flips in place regardless of the active layer; dimensions
	 * are unchanged and the Reference Layer stays fixed. An active Marquee is
	 * mirrored across the same axis and clipped to the canvas.
	 */
	flip_canvas_horizontal(): void;
	/** Mirrors the whole canvas vertically. Mirror of {@link flip_canvas_horizontal}. */
	flip_canvas_vertical(): void;
	/**
	 * Rotates the whole canvas 90° clockwise: every Pixel Layer's every cel
	 * (all frames) turns regardless of the active layer, the canvas
	 * width/height swap, and the Reference Layer stays fixed. An active
	 * Marquee is carried through the same quarter-turn into the swapped
	 * dimensions and clipped to the new canvas.
	 */
	rotate_canvas_cw(): void;
	/** Rotates the whole canvas 90° counter-clockwise. Mirror of {@link rotate_canvas_cw}. */
	rotate_canvas_ccw(): void;
	/**
	 * Rotates the current Marquee region on the active Pixel Layer's
	 * active-frame cel 90° clockwise. The region's `W×H` pixels become an
	 * `H×W` block re-centered on the region's center and clipped to the
	 * canvas; the Marquee updates to wrap the new region. The Document's
	 * dimensions never change. No-op without a Marquee or on a Reference
	 * Layer.
	 */
	rotate_marquee_cw(): void;
	/** Rotates the current Marquee region 90° counter-clockwise. Mirror of {@link rotate_marquee_cw}. */
	rotate_marquee_ccw(): void;
	/**
	 * Source-over composites row-major RGBA `buffer` at `region`. `buffer`
	 * must contain `region.width × region.height × 4` bytes; implementations
	 * throw when that length is invalid.
	 */
	composite_buffer_at(buffer: Uint8Array, region: MarqueeRegion): void;
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
	/**
	 * Returns every layer's metadata in stack order (index 0 = bottom-most) in
	 * a single crossing. Reference-only fields are populated only for Reference
	 * Layers. Bulk pixel buffers are excluded — fetch them on demand via
	 * `layer_pixels_at` / `layer_source_pixels_at`.
	 */
	layers_metadata(): LayerMetadata[];
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
	/** Returns a Reference Layer's source RGBA buffer, or `undefined` for Pixel Layers / out of range. */
	layer_source_pixels_at(index: number): Uint8Array | undefined;
	/**
	 * Returns the Reference Layer's {@link ReferenceFootprint} — its projected
	 * axis-aligned bounding box in canvas-pixel coordinates — at `stackIndex`, or
	 * `undefined` for a Pixel Layer / out of range.
	 */
	reference_layer_footprint_at(stackIndex: number): ReferenceFootprint | undefined;
	active_frame_id(): string;
	frame_count(): number;
	/**
	 * Every frame's metadata in axis order (`index 0` is the first frame,
	 * displayed as ordinal 1) in a single crossing.
	 */
	frames_metadata(): FrameMetadata[];
	/**
	 * Returns the RGBA pixel buffer of the cel at (`layer_index`, `frame_id`)
	 * without moving the active-frame pointer, or `undefined` when `layer_index`
	 * is out of range, the layer is not a Pixel Layer, or no frame with
	 * `frame_id` exists. Throws when `frame_id` is not a valid UUID.
	 */
	cel_pixels_at(layer_index: number, frame_id: string): Uint8Array | undefined;
	/**
	 * Inserts a transparent frame directly after the active frame, seeds a cel
	 * for it on every Pixel Layer, and makes it active. Throws when `new_id` is
	 * not a valid UUID or already exists on the axis.
	 */
	add_frame(new_id: string): void;
	/**
	 * Inserts a deep copy of the active frame directly after it — cloning every
	 * Pixel Layer's active-frame cel — and makes the copy active. Throws when
	 * `new_id` is not a valid UUID or already exists on the axis.
	 */
	duplicate_frame(new_id: string): void;
	/**
	 * Removes the frame with `id`, dropping its cel from every Pixel Layer.
	 * Throws when the frame does not exist or when removing it would empty the
	 * axis (a document must always contain at least one frame). When the removed
	 * frame was active, the active pointer moves to an adjacent frame.
	 */
	remove_frame(id: string): void;
	/**
	 * Moves the frame with `id` to `new_index` (0-based axis position), silently
	 * clamped to `[0, frame_count - 1]`. The active frame pointer is preserved
	 * (tracked by id, not index). Throws when no frame with `id` exists.
	 */
	reorder_frame(id: string, new_index: number): void;
	/**
	 * Sets the active frame pointer by id. Throws if no frame with this id
	 * exists; the previous active frame is preserved on error.
	 */
	set_active_frame(id: string): void;
	/**
	 * Sets the display duration (in milliseconds) of the frame with `id`,
	 * clamped to `[1, 60_000]` ms at the binding boundary. Clamping never
	 * throws; throws only when `id` is not a valid UUID or no frame with that
	 * id exists on the axis.
	 */
	set_frame_duration(id: string, duration_ms: number): void;
}
