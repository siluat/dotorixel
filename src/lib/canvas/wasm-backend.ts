/**
 * WASM adapter — the single production file that imports from `$wasm/dotorixel_wasm`.
 *
 * Exports factory singletons and a DrawingOps factory. Consumers import from here
 * instead of importing WASM directly.
 */

import {
	WasmPixelCanvas,
	WasmColor,
	WasmViewport,
	WasmHistoryManager,
	WasmResizeAnchor,
	WasmToolType,
	apply_tool,
	wasm_interpolate_pixels,
	wasm_rectangle_outline,
	wasm_ellipse_outline,
	wasm_flood_fill
} from '$wasm/dotorixel_wasm';
import type { CanvasFactory } from './canvas-factory';
import type { ViewportFactory } from './viewport-factory';
import type { HistoryManager } from './history';
import type { DrawingOps, DrawingToolType } from './drawing-ops';
import type { ResizeAnchor } from './view-types';

// ── Internal mappings ───────────────────────────────────────────────

const ANCHOR_MAP: Record<ResizeAnchor, WasmResizeAnchor> = {
	'top-left': WasmResizeAnchor.TopLeft,
	'top-center': WasmResizeAnchor.TopCenter,
	'top-right': WasmResizeAnchor.TopRight,
	'middle-left': WasmResizeAnchor.MiddleLeft,
	center: WasmResizeAnchor.Center,
	'middle-right': WasmResizeAnchor.MiddleRight,
	'bottom-left': WasmResizeAnchor.BottomLeft,
	'bottom-center': WasmResizeAnchor.BottomCenter,
	'bottom-right': WasmResizeAnchor.BottomRight
};

const TOOL_MAP: Record<DrawingToolType, WasmToolType> = {
	pencil: WasmToolType.Pencil,
	eraser: WasmToolType.Eraser,
	line: WasmToolType.Line,
	rectangle: WasmToolType.Rectangle,
	ellipse: WasmToolType.Ellipse
};

// ── CanvasFactory ───────────────────────────────────────────────────

export const canvasFactory: CanvasFactory = {
	create: (w, h) => new WasmPixelCanvas(w, h),
	fromPixels: (w, h, p) => WasmPixelCanvas.from_pixels(w, h, p),
	withColor: (w, h, c) =>
		WasmPixelCanvas.with_color(w, h, new WasmColor(c.r, c.g, c.b, c.a)),
	resizeWithAnchor(canvas, newWidth, newHeight, anchor) {
		const wasmCanvas = WasmPixelCanvas.from_pixels(
			canvas.width,
			canvas.height,
			canvas.pixels()
		);
		return wasmCanvas.resize_with_anchor(newWidth, newHeight, ANCHOR_MAP[anchor]);
	},
	get minDimension() {
		return WasmPixelCanvas.min_dimension();
	},
	get maxDimension() {
		return WasmPixelCanvas.max_dimension();
	},
	isValidDimension: (v) => WasmPixelCanvas.is_valid_dimension(v),
	presets: () => Array.from(WasmPixelCanvas.presets())
};

// ── ViewportFactory ─────────────────────────────────────────────────

export const viewportFactory: ViewportFactory = {
	create: (ps, z, px, py) => new WasmViewport(ps, z, px, py),
	forCanvas: (cw, ch) => WasmViewport.for_canvas(cw, ch),
	clampZoom: (z) => WasmViewport.clamp_zoom(z),
	computePinchZoom: (cz, dy) => WasmViewport.compute_pinch_zoom(cz, dy),
	nextZoomLevel: (cz) => WasmViewport.next_zoom_level(cz),
	prevZoomLevel: (cz) => WasmViewport.prev_zoom_level(cz),
	defaultPixelSize: (cw, ch) => WasmViewport.default_pixel_size(cw, ch),
	zoomLevels: () => Array.from(WasmViewport.zoom_levels()),
	get minZoom() {
		return WasmViewport.min_zoom();
	},
	get maxZoom() {
		return WasmViewport.max_zoom();
	}
};

// ── DrawingOps ──────────────────────────────────────────────────────

/**
 * Creates a DrawingOps instance bound to a canvas getter.
 * The getter is called on every drawing operation, so it always operates
 * on the current canvas (which may be replaced by undo/redo).
 */
export function createDrawingOps(getCanvas: () => WasmPixelCanvas): DrawingOps {
	return {
		applyTool(x, y, tool, color) {
			return apply_tool(
				getCanvas(),
				x,
				y,
				TOOL_MAP[tool],
				new WasmColor(color.r, color.g, color.b, color.a)
			);
		},
		floodFill(x, y, color) {
			return wasm_flood_fill(
				getCanvas(),
				x,
				y,
				new WasmColor(color.r, color.g, color.b, color.a)
			);
		},
		interpolatePixels: wasm_interpolate_pixels,
		rectangleOutline: wasm_rectangle_outline,
		ellipseOutline: wasm_ellipse_outline
	};
}

// ── HistoryManager ──────────────────────────────────────────────────

export function createHistoryManager(): HistoryManager {
	return WasmHistoryManager.default_manager();
}
