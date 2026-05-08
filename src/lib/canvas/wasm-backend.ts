/**
 * WASM adapter — the single production file that imports from `$wasm/dotorixel_wasm`.
 *
 * Exports factory singletons and a DrawingOps factory. Consumers import from here
 * instead of importing WASM directly.
 */

import {
	WasmPixelCanvas,
	WasmColor,
	WasmDocument,
	WasmDocumentBuilder,
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
import type { Document, PixelCanvas, ResizeAnchor } from './canvas-model';
import type { CanvasFactory, CanvasConstraints, HistoryManager } from './adapter-types';
import type { DocumentSchemaV3 } from '$lib/session/session-storage-types';
import type { ViewportData, ViewportOps } from './viewport';
import type { DrawingOps, DrawingToolType } from './drawing-ops';
import type { CanvasBackend } from './editor-session/canvas-backend';

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
	}
};

export const canvasConstraints: CanvasConstraints = {
	get minDimension() {
		return WasmPixelCanvas.min_dimension();
	},
	get maxDimension() {
		return WasmPixelCanvas.max_dimension();
	},
	isValidDimension: (v) => WasmPixelCanvas.is_valid_dimension(v),
	presets: () => Array.from(WasmPixelCanvas.presets())
};

// ── ViewportOps ────────────────────────────────────────────────────

const DEFAULT_SHOW_GRID = true;
const DEFAULT_GRID_COLOR = '#cccccc';

function toWasm(vd: ViewportData): WasmViewport {
	return new WasmViewport(vd.pixelSize, vd.zoom, vd.panX, vd.panY);
}

export const viewportOps: ViewportOps = {
	// Camera transforms
	screenToCanvas(vd, screenX, screenY) {
		const coords = toWasm(vd).screen_to_canvas(screenX, screenY);
		return { x: coords.x, y: coords.y };
	},
	zoomAtPoint(vd, screenX, screenY, newZoom) {
		const result = toWasm(vd).zoom_at_point(screenX, screenY, newZoom);
		return { ...vd, zoom: result.zoom, panX: result.pan_x, panY: result.pan_y };
	},
	pan(vd, deltaX, deltaY) {
		const result = toWasm(vd).pan(deltaX, deltaY);
		return { ...vd, panX: result.pan_x, panY: result.pan_y };
	},
	clampPan(vd, canvasWidth, canvasHeight, viewportWidth, viewportHeight) {
		const result = toWasm(vd).clamp_pan(canvasWidth, canvasHeight, viewportWidth, viewportHeight);
		return { ...vd, panX: result.pan_x, panY: result.pan_y };
	},
	fitToViewport(vd, canvasWidth, canvasHeight, viewportWidth, viewportHeight, maxZoom) {
		const result = toWasm(vd).fit_to_viewport(
			canvasWidth,
			canvasHeight,
			viewportWidth,
			viewportHeight,
			maxZoom
		);
		return {
			...vd,
			pixelSize: result.pixel_size,
			zoom: result.zoom,
			panX: result.pan_x,
			panY: result.pan_y
		};
	},
	effectivePixelSize(vd) {
		return toWasm(vd).effective_pixel_size();
	},
	displaySize(vd, canvasWidth, canvasHeight) {
		const size = toWasm(vd).display_size(canvasWidth, canvasHeight);
		return { width: size.width, height: size.height };
	},
	forCanvas(canvasWidth, canvasHeight) {
		const wasm = WasmViewport.for_canvas(canvasWidth, canvasHeight);
		return {
			pixelSize: wasm.pixel_size,
			zoom: wasm.zoom,
			panX: wasm.pan_x,
			panY: wasm.pan_y,
			showGrid: DEFAULT_SHOW_GRID,
			gridColor: DEFAULT_GRID_COLOR
		};
	},

	// Zoom arithmetic
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

function resolveWasmCanvas(canvas: PixelCanvas): WasmPixelCanvas {
	if (canvas instanceof WasmPixelCanvas) return canvas;
	throw new Error('Canvas was not created by canvasFactory');
}

/**
 * Creates a DrawingOps instance bound to a canvas getter.
 * The getter is called on every drawing operation, so it always operates
 * on the current canvas (which may be replaced by undo/redo).
 */
export function createDrawingOps(getCanvas: () => PixelCanvas): DrawingOps {
	function inBounds(canvas: WasmPixelCanvas, x: number, y: number): boolean {
		return x >= 0 && y >= 0 && canvas.is_inside_bounds(x, y);
	}

	const ops: DrawingOps = {
		applyTool(x, y, tool, color) {
			return apply_tool(
				resolveWasmCanvas(getCanvas()),
				x,
				y,
				TOOL_MAP[tool],
				new WasmColor(color.r, color.g, color.b, color.a)
			);
		},
		applyStroke(pixels, tool, color) {
			let changed = false;
			for (let i = 0; i < pixels.length; i += 2) {
				if (ops.applyTool(pixels[i], pixels[i + 1], tool, color)) {
					changed = true;
				}
			}
			return changed;
		},
		setPixel(x, y, color) {
			const canvas = resolveWasmCanvas(getCanvas());
			if (!inBounds(canvas, x, y)) return false;
			canvas.set_pixel(x, y, new WasmColor(color.r, color.g, color.b, color.a));
			return true;
		},
		getPixel(x, y) {
			const canvas = resolveWasmCanvas(getCanvas());
			if (!inBounds(canvas, x, y)) return null;
			const c = canvas.get_pixel(x, y);
			return { r: c.r, g: c.g, b: c.b, a: c.a };
		},
		floodFill(x, y, color) {
			return wasm_flood_fill(
				resolveWasmCanvas(getCanvas()),
				x,
				y,
				new WasmColor(color.r, color.g, color.b, color.a)
			);
		},
		interpolatePixels: wasm_interpolate_pixels,
		rectangleOutline: wasm_rectangle_outline,
		ellipseOutline: wasm_ellipse_outline
	};

	return ops;
}

function resolveWasmDocument(doc: Document): WasmDocument {
	if (doc instanceof WasmDocument) return doc;
	throw new Error('Document was not created by wasm-backend');
}

/**
 * Clears the active layer's pixels in place. Used by the tool runner's
 * `clear()` to keep the shadow `Document` aligned with `pixelCanvas` during
 * the strangler migration; the read-only `Document` interface intentionally
 * omits mutators, so callers go through this helper.
 */
export function clearDocumentActiveLayer(doc: Document): void {
	resolveWasmDocument(doc).clear();
}

/**
 * Resizes a `Document` in place using the given anchor. All layers are
 * resized using the same anchor — see `crates/core/src/document.rs` for the
 * row-major copy semantics.
 */
export function resizeDocumentWithAnchor(
	doc: Document,
	newWidth: number,
	newHeight: number,
	anchor: ResizeAnchor
): void {
	resolveWasmDocument(doc).resize(newWidth, newHeight, ANCHOR_MAP[anchor]);
}

/**
 * DrawingOps that mutate a `Document`'s active layer. Used by the strangler
 * migration to tee tool writes so the shadow `Document` on `TabState` stays
 * in sync with `pixelCanvas` until the latter is removed.
 */
export function createDocumentDrawingOps(getDocument: () => Document): DrawingOps {
	const ops: DrawingOps = {
		applyTool(x, y, tool, color) {
			return resolveWasmDocument(getDocument()).apply_tool(
				x,
				y,
				TOOL_MAP[tool],
				new WasmColor(color.r, color.g, color.b, color.a)
			);
		},
		applyStroke(pixels, tool, color) {
			let changed = false;
			for (let i = 0; i < pixels.length; i += 2) {
				if (ops.applyTool(pixels[i], pixels[i + 1], tool, color)) {
					changed = true;
				}
			}
			return changed;
		},
		setPixel(x, y, color) {
			const doc = resolveWasmDocument(getDocument());
			if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return false;
			try {
				doc.set_pixel(x, y, new WasmColor(color.r, color.g, color.b, color.a));
				return true;
			} catch {
				return false;
			}
		},
		getPixel(x, y) {
			const doc = resolveWasmDocument(getDocument());
			if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return null;
			try {
				const c = doc.get_pixel(x, y);
				return { r: c.r, g: c.g, b: c.b, a: c.a };
			} catch {
				return null;
			}
		},
		floodFill(x, y, color) {
			return resolveWasmDocument(getDocument()).flood_fill(
				x,
				y,
				new WasmColor(color.r, color.g, color.b, color.a)
			);
		},
		interpolatePixels: wasm_interpolate_pixels,
		rectangleOutline: wasm_rectangle_outline,
		ellipseOutline: wasm_ellipse_outline
	};

	return ops;
}

/**
 * Wraps two `DrawingOps` so each mutating call runs on both. Reads and pure
 * outline/interpolation helpers delegate to `primary`. The return value of
 * mutating calls comes from `primary` — assumes both ops produce equivalent
 * results given the same starting state (true while the two backings stay
 * in sync via this tee).
 */
export function teeDrawingOps(primary: DrawingOps, secondary: DrawingOps): DrawingOps {
	return {
		applyTool(x, y, tool, color) {
			const result = primary.applyTool(x, y, tool, color);
			secondary.applyTool(x, y, tool, color);
			return result;
		},
		applyStroke(pixels, tool, color) {
			const result = primary.applyStroke(pixels, tool, color);
			secondary.applyStroke(pixels, tool, color);
			return result;
		},
		setPixel(x, y, color) {
			const result = primary.setPixel(x, y, color);
			secondary.setPixel(x, y, color);
			return result;
		},
		getPixel(x, y) {
			return primary.getPixel(x, y);
		},
		floodFill(x, y, color) {
			const result = primary.floodFill(x, y, color);
			secondary.floodFill(x, y, color);
			return result;
		},
		interpolatePixels: primary.interpolatePixels,
		rectangleOutline: primary.rectangleOutline,
		ellipseOutline: primary.ellipseOutline
	};
}

// ── HistoryManager ──────────────────────────────────────────────────

export function createHistoryManager(): HistoryManager {
	return WasmHistoryManager.default_manager();
}

// ── Document hydration ──────────────────────────────────────────────

/**
 * Builds a [`Document`] from a persisted V3 schema. Each layer's pixel
 * buffer must already be in the schema's `width × height × 4` shape;
 * validation errors from the WASM builder propagate as thrown `Error`s.
 */
export function documentFromSchemaV3(schema: DocumentSchemaV3): Document {
	const builder = new WasmDocumentBuilder(schema.width, schema.height);
	for (const layer of schema.layers) {
		builder.add_layer(
			layer.id,
			layer.name,
			layer.pixels.slice(),
			layer.visible,
			layer.opacity
		);
	}
	return builder.build(
		schema.activeLayerId,
		schema.nextLayerNumber,
		schema.timelinePanelCollapsed
	);
}

/**
 * Builds a single-layer [`Document`] containing the given pixel buffer as
 * "Layer 1". Used by the strangler migration to mirror a `PixelCanvas` into
 * a `Document` without going through V3 schema serialization.
 */
export function singleLayerDocument(
	width: number,
	height: number,
	pixels: Uint8Array
): Document {
	const builder = new WasmDocumentBuilder(width, height);
	const id = crypto.randomUUID();
	builder.add_layer(id, 'Layer 1', pixels.slice(), true, 1);
	return builder.build(id, 2, false);
}

// ── CanvasBackend umbrella ─────────────────────────────────────────

/**
 * Production `CanvasBackend` — aggregates the WASM-backed adapters above
 * into the single injection point consumed by editor-session layers
 * (TabState, Workspace). Individual exports remain available for callers
 * that need a narrower dependency.
 */
export const wasmBackend: CanvasBackend = {
	canvasFactory,
	canvasConstraints,
	viewportOps,
	createHistoryManager,
	createDrawingOps
};
