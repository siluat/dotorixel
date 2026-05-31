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
	WasmReferencePlacement,
	WasmMarqueeRegion,
	WasmToolType,
	apply_tool,
	wasm_interpolate_pixels,
	wasm_rectangle_outline,
	wasm_ellipse_outline,
	wasm_flood_fill,
	wasm_flood_fill_bounded
} from '$wasm/dotorixel_wasm';
import type {
	Document,
	MarqueeRegion,
	PixelCanvas,
	ResizeAnchor,
	ReferencePlacement
} from './canvas-model';
import type { CanvasFactory, CanvasConstraints, HistoryManager } from './adapter-types';
import type {
	MarqueeRecord,
	PixelLayerRecord,
	PixelLayerRecordV3,
	ReferenceLayerRecord
} from '$lib/session/session-storage-types';
import type { ViewportData, ViewportOps } from './viewport';
import type { DrawingOps, DrawingToolType, MarqueeBounds } from './drawing-ops';
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

function marqueeBoundsToWasm(region: MarqueeBounds): WasmMarqueeRegion | null {
	if (region.width <= 0 || region.height <= 0) return null;
	return WasmMarqueeRegion.from_drag(
		region.x,
		region.y,
		region.x + region.width - 1,
		region.y + region.height - 1
	);
}

function roundLikeRust(value: number): number {
	return value < 0 ? -Math.round(-value) : Math.round(value);
}

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
	screenToCanvasPoint(vd, screenX, screenY) {
		const scaledPixel = toWasm(vd).effective_pixel_size();
		return {
			x: (screenX - roundLikeRust(vd.panX)) / scaledPixel,
			y: (screenY - roundLikeRust(vd.panY)) / scaledPixel
		};
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
	clampPanToDocumentBounds(vd, minX, minY, maxX, maxY, viewportWidth, viewportHeight) {
		const result = toWasm(vd).clamp_pan_to_document_bounds(
			minX,
			minY,
			maxX,
			maxY,
			viewportWidth,
			viewportHeight
		);
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

// ── ReferencePlacement ──────────────────────────────────────────────

export function fitReferencePlacementToCanvas(
	canvasWidth: number,
	canvasHeight: number,
	naturalWidth: number,
	naturalHeight: number
): ReferencePlacement {
	const placement = WasmReferencePlacement.fit_to_canvas(
		canvasWidth,
		canvasHeight,
		naturalWidth,
		naturalHeight
	);
	return { x: placement.x, y: placement.y, scale: placement.scale };
}

// ── MarqueeRegion ─────────────────────────────────────────────────

export function marqueeRegionFromDrag(
	x0: number,
	y0: number,
	x1: number,
	y1: number
): MarqueeRegion {
	return WasmMarqueeRegion.from_drag(x0, y0, x1, y1);
}

export function copyMarqueeRegion(region: MarqueeRegion): MarqueeRegion {
	return WasmMarqueeRegion.from_drag(
		region.x,
		region.y,
		region.x + region.width - 1,
		region.y + region.height - 1
	);
}

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
		floodFill(x, y, color, bounds) {
			const canvas = resolveWasmCanvas(getCanvas());
			const wasmColor = new WasmColor(color.r, color.g, color.b, color.a);
			if (bounds) {
				const wasmBounds = marqueeBoundsToWasm(bounds);
				return wasmBounds
					? wasm_flood_fill_bounded(canvas, x, y, wasmColor, wasmBounds)
					: false;
			}
			return wasm_flood_fill(canvas, x, y, wasmColor);
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
 * Clears the active layer's pixels in place. The read-only `Document`
 * interface intentionally omits mutators, so callers go through this helper.
 */
export function clearActiveLayerPixels(doc: Document): void {
	resolveWasmDocument(doc).clear();
}

/**
 * Returns the active layer's RGBA pixel buffer. Used by tools that snapshot
 * the active layer at stroke begin and restore it during preview (shape
 * tools, move tool). Throws when the active layer id is not found in the
 * document (an invariant violation that indicates corrupted state).
 */
export function activeLayerPixels(doc: Document): Uint8Array {
	const id = doc.active_layer_id();
	for (let i = 0; i < doc.layer_count(); i++) {
		if (doc.layer_id_at(i) === id) {
			const pixels = doc.layer_pixels_at(i);
			if (!pixels) {
				throw new Error(`Active layer ${id} (index ${i}) has no pixel buffer`);
			}
			return pixels;
		}
	}
	throw new Error(`Active layer ${id} not found in document`);
}

/**
 * Overwrites the active layer's pixel buffer. Inverse of
 * `activeLayerPixels`. Used by shape and move tools to restore the
 * stroke-start snapshot during mid-stroke preview.
 */
export function restoreActiveLayerPixels(doc: Document, pixels: Uint8Array): void {
	doc.restore_active_layer_pixels(pixels);
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
 * DrawingOps that mutate a `Document`'s active layer. Backs the tool runner's
 * writes; the `Document` is the single source of truth for pixel data.
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
		floodFill(x, y, color, bounds) {
			const document = resolveWasmDocument(getDocument());
			const wasmColor = new WasmColor(color.r, color.g, color.b, color.a);
			if (bounds) {
				const wasmBounds = marqueeBoundsToWasm(bounds);
				return wasmBounds
					? document.flood_fill_bounded(x, y, wasmColor, wasmBounds)
					: false;
			}
			return document.flood_fill(x, y, wasmColor);
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
		floodFill(x, y, color, bounds) {
			const result = primary.floodFill(x, y, color, bounds);
			secondary.floodFill(x, y, color, bounds);
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

export interface DocumentLayerSource {
	readonly width: number;
	readonly height: number;
	readonly marquee?: MarqueeRecord | null;
	readonly layers: readonly HydratableLayerRecord[];
	readonly activeLayerId: string;
	readonly nextLayerNumber: number;
	readonly timelinePanelCollapsed: boolean;
}

export interface HydratedReferenceLayerRecord extends ReferenceLayerRecord {
	readonly sourceRgba: Uint8Array;
}

type HydratablePixelLayerRecord = PixelLayerRecordV3 | PixelLayerRecord;
type HydratableLayerRecord = HydratablePixelLayerRecord | HydratedReferenceLayerRecord;

function isReferenceLayer(
	layer: HydratableLayerRecord
): layer is HydratedReferenceLayerRecord {
	return 'kind' in layer && layer.kind === 'reference';
}

/**
 * Builds a [`Document`] from any value carrying the [`DocumentLayerSource`]
 * shape — e.g. a persisted V3 schema or a `TabSnapshot`. Each layer's pixel
 * buffer must already be in the source's `width × height × 4` shape;
 * validation errors from the WASM builder propagate as thrown `Error`s.
 */
export function documentFromLayerSource(source: DocumentLayerSource): Document {
	const builder = new WasmDocumentBuilder(source.width, source.height);
	for (const layer of source.layers) {
		if (isReferenceLayer(layer)) {
			builder.add_reference_layer(
				layer.id,
				layer.name,
				layer.sourceRgba.slice(),
				layer.naturalWidth,
				layer.naturalHeight,
				layer.placement.x,
				layer.placement.y,
				layer.placement.scale,
				layer.visible,
				layer.opacity
			);
		} else {
			builder.add_layer(
				layer.id,
				layer.name,
				layer.pixels.slice(),
				layer.visible,
				layer.opacity
			);
		}
	}
	const document = builder.build(
		source.activeLayerId,
		source.nextLayerNumber,
		source.timelinePanelCollapsed
	);
	if (source.marquee) {
		const clipped = marqueeBoundsToWasm(source.marquee)?.clip_to(source.width, source.height);
		if (clipped) {
			document.set_marquee(clipped);
		}
	}
	return document;
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
