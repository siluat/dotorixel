import type { CanvasCoords, ViewportSize } from './view-types';

/**
 * Immutable camera state — zoom, pan, coordinate mapping.
 * Every mutation method returns a new instance.
 *
 * Structurally satisfied by WasmViewport — no wrapping needed at runtime.
 */
export interface Viewport {
	readonly pixel_size: number;
	readonly zoom: number;
	readonly pan_x: number;
	readonly pan_y: number;

	effective_pixel_size(): number;
	screen_to_canvas(screen_x: number, screen_y: number): CanvasCoords;
	display_size(canvas_width: number, canvas_height: number): ViewportSize;

	zoom_at_point(screen_x: number, screen_y: number, new_zoom: number): Viewport;
	pan(delta_x: number, delta_y: number): Viewport;
	clamp_pan(
		canvas_width: number,
		canvas_height: number,
		viewport_width: number,
		viewport_height: number
	): Viewport;
	fit_to_viewport(
		canvas_width: number,
		canvas_height: number,
		viewport_width: number,
		viewport_height: number,
		max_zoom: number
	): Viewport;
}
