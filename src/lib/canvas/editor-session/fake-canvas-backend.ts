import type { PixelCanvas } from '../canvas-model';
import type { Color } from '../color';
import type { CanvasFactory, CanvasConstraints, HistoryManager, Snapshot } from '../adapter-types';
import type { ViewportData, ViewportOps, ViewportSize } from '../viewport';
import type { DrawingOps, DrawingToolType } from '../drawing-ops';
import { createFakePixelCanvas } from '../fake-drawing-ops';
import type { CanvasBackend } from './canvas-backend';

const FAKE_MIN_DIMENSION = 1;
const FAKE_MAX_DIMENSION = 256;
const FAKE_PRESETS: readonly number[] = [8, 16, 32, 64, 128];
const FAKE_ZOOM_LEVELS: readonly number[] = [0.25, 0.5, 1, 2, 4, 8, 16];
const FAKE_MIN_ZOOM = 0.25;
const FAKE_MAX_ZOOM = 16;
const FAKE_DEFAULT_PIXEL_SIZE = 8;
const FAKE_TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

function fillPixels(width: number, height: number, color: Color): Uint8Array {
	const state = new Uint8Array(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		state[i * 4] = color.r;
		state[i * 4 + 1] = color.g;
		state[i * 4 + 2] = color.b;
		state[i * 4 + 3] = color.a;
	}
	return state;
}

export const fakeCanvasFactory: CanvasFactory = {
	create: (width, height) => createFakePixelCanvas(width, height),
	fromPixels: (width, height, pixels) => {
		const canvas = createFakePixelCanvas(width, height);
		canvas.restore_pixels(pixels);
		return canvas;
	},
	withColor: (width, height, color) => {
		const canvas = createFakePixelCanvas(width, height);
		canvas.restore_pixels(fillPixels(width, height, color));
		return canvas;
	},
	resizeWithAnchor() {
		throw new Error(
			'fakeCanvasFactory.resizeWithAnchor: not implemented; tests that exercise anchor-based resize should use the WASM backend.'
		);
	}
};

export const fakeCanvasConstraints: CanvasConstraints = {
	minDimension: FAKE_MIN_DIMENSION,
	maxDimension: FAKE_MAX_DIMENSION,
	isValidDimension: (v) =>
		Number.isInteger(v) && v >= FAKE_MIN_DIMENSION && v <= FAKE_MAX_DIMENSION,
	presets: () => [...FAKE_PRESETS]
};

/**
 * Minimal in-memory viewport ops for unit tests.
 *
 * Simple math (pan, effectivePixelSize, displaySize, zoom bookkeeping) is
 * implemented directly. `zoomAtPoint` does not center on the cursor — tests
 * that require WASM-equivalent camera behavior should inject the WASM
 * backend. Out-of-scope operations throw a clear message.
 */
export const fakeViewportOps: ViewportOps = {
	screenToCanvas(vd, screenX, screenY) {
		const effective = vd.pixelSize * vd.zoom;
		return {
			x: Math.floor((screenX - vd.panX) / effective),
			y: Math.floor((screenY - vd.panY) / effective)
		};
	},
	zoomAtPoint(vd, _screenX, _screenY, newZoom) {
		return { ...vd, zoom: newZoom };
	},
	pan(vd, deltaX, deltaY) {
		return { ...vd, panX: vd.panX + deltaX, panY: vd.panY + deltaY };
	},
	clampPan(vd, _canvasWidth, _canvasHeight, _viewportWidth, _viewportHeight) {
		return vd;
	},
	fitToViewport(vd, canvasWidth, canvasHeight, viewportWidth, viewportHeight, _maxZoom) {
		const fitPixel = Math.max(
			1,
			Math.floor(Math.min(viewportWidth / canvasWidth, viewportHeight / canvasHeight))
		);
		return { ...vd, zoom: 1, pixelSize: fitPixel, panX: 0, panY: 0 };
	},
	effectivePixelSize(vd) {
		return vd.pixelSize * vd.zoom;
	},
	displaySize(vd, canvasWidth, canvasHeight): ViewportSize {
		const effective = vd.pixelSize * vd.zoom;
		return { width: canvasWidth * effective, height: canvasHeight * effective };
	},
	forCanvas(_canvasWidth, _canvasHeight): ViewportData {
		return {
			pixelSize: FAKE_DEFAULT_PIXEL_SIZE,
			zoom: 1,
			panX: 0,
			panY: 0,
			showGrid: true,
			gridColor: '#cccccc'
		};
	},
	clampZoom: (zoom) => Math.min(FAKE_MAX_ZOOM, Math.max(FAKE_MIN_ZOOM, zoom)),
	computePinchZoom: (currentZoom, _deltaY) => currentZoom,
	nextZoomLevel: (currentZoom) => {
		for (const z of FAKE_ZOOM_LEVELS) {
			if (z > currentZoom) return z;
		}
		return FAKE_MAX_ZOOM;
	},
	prevZoomLevel: (currentZoom) => {
		for (let i = FAKE_ZOOM_LEVELS.length - 1; i >= 0; i--) {
			if (FAKE_ZOOM_LEVELS[i] < currentZoom) return FAKE_ZOOM_LEVELS[i];
		}
		return FAKE_MIN_ZOOM;
	},
	defaultPixelSize: (_canvasWidth, _canvasHeight) => FAKE_DEFAULT_PIXEL_SIZE,
	zoomLevels: () => [...FAKE_ZOOM_LEVELS],
	minZoom: FAKE_MIN_ZOOM,
	maxZoom: FAKE_MAX_ZOOM
};

/** In-memory undo/redo stack — pure TypeScript, no WASM. */
export function createInMemoryHistoryManager(): HistoryManager {
	const undoStack: Snapshot[] = [];
	const redoStack: Snapshot[] = [];

	function snapshot(width: number, height: number, pixels: Uint8Array): Snapshot {
		const frozen = new Uint8Array(pixels);
		return {
			width,
			height,
			pixels: () => new Uint8Array(frozen)
		};
	}

	return {
		can_undo: () => undoStack.length > 0,
		can_redo: () => redoStack.length > 0,
		clear() {
			undoStack.length = 0;
			redoStack.length = 0;
		},
		push_snapshot(width, height, pixels) {
			undoStack.push(snapshot(width, height, pixels));
			redoStack.length = 0;
		},
		undo(currentWidth, currentHeight, currentPixels) {
			const previous = undoStack.pop();
			if (!previous) return undefined;
			redoStack.push(snapshot(currentWidth, currentHeight, currentPixels));
			return previous;
		},
		redo(currentWidth, currentHeight, currentPixels) {
			const next = redoStack.pop();
			if (!next) return undefined;
			undoStack.push(snapshot(currentWidth, currentHeight, currentPixels));
			return next;
		}
	};
}

function colorsEqual(a: Color, b: Color): boolean {
	return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

function toolColor(tool: DrawingToolType, color: Color): Color {
	return tool === 'eraser' ? FAKE_TRANSPARENT : color;
}

/**
 * DrawingOps that reads and writes through the `PixelCanvas` interface
 * (via `get_pixel` and `restore_pixels`). State stays in sync with the
 * canvas returned by `getCanvas()` — tests can assert results through
 * either `canvas.get_pixel(x, y)` or `ops.getPixel(x, y)`.
 *
 * Implements pencil / eraser / line / rectangle via Bresenham and axis-aligned
 * algorithms. `floodFill` uses BFS. `ellipseOutline` throws — tests that
 * exercise ellipses should use the WASM backend.
 */
export function createInMemoryDrawingOps(getCanvas: () => PixelCanvas): DrawingOps {
	function writePixel(x: number, y: number, color: Color): boolean {
		const canvas = getCanvas();
		if (!canvas.is_inside_bounds(x, y)) return false;
		const buffer = canvas.pixels();
		const index = (y * canvas.width + x) * 4;
		buffer[index] = color.r;
		buffer[index + 1] = color.g;
		buffer[index + 2] = color.b;
		buffer[index + 3] = color.a;
		canvas.restore_pixels(buffer);
		return true;
	}

	const ops: DrawingOps = {
		applyTool(x, y, tool, color) {
			const canvas = getCanvas();
			if (!canvas.is_inside_bounds(x, y)) return false;
			const current = canvas.get_pixel(x, y);
			const next = toolColor(tool, color);
			if (colorsEqual(current, next)) return false;
			return writePixel(x, y, next);
		},
		applyStroke(pixels, tool, color) {
			let changed = false;
			for (let i = 0; i + 1 < pixels.length; i += 2) {
				if (ops.applyTool(pixels[i], pixels[i + 1], tool, color)) changed = true;
			}
			return changed;
		},
		setPixel(x, y, color) {
			return writePixel(x, y, color);
		},
		getPixel(x, y) {
			const canvas = getCanvas();
			if (!canvas.is_inside_bounds(x, y)) return null;
			const p = canvas.get_pixel(x, y);
			return { r: p.r, g: p.g, b: p.b, a: p.a };
		},
		floodFill(x, y, color) {
			const canvas = getCanvas();
			if (!canvas.is_inside_bounds(x, y)) return false;
			const target = canvas.get_pixel(x, y);
			if (colorsEqual(target, color)) return false;
			const visited = new Set<string>();
			const queue: Array<[number, number]> = [[x, y]];
			let changed = false;
			while (queue.length > 0) {
				const [cx, cy] = queue.shift()!;
				const key = `${cx},${cy}`;
				if (visited.has(key)) continue;
				visited.add(key);
				if (!canvas.is_inside_bounds(cx, cy)) continue;
				const here = canvas.get_pixel(cx, cy);
				if (!colorsEqual(here, target)) continue;
				if (writePixel(cx, cy, color)) changed = true;
				queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
			}
			return changed;
		},
		interpolatePixels(x0, y0, x1, y1) {
			const result: number[] = [];
			const dx = Math.abs(x1 - x0);
			const dy = Math.abs(y1 - y0);
			const sx = x0 < x1 ? 1 : -1;
			const sy = y0 < y1 ? 1 : -1;
			let err = dx - dy;
			let cx = x0;
			let cy = y0;
			while (true) {
				result.push(cx, cy);
				if (cx === x1 && cy === y1) break;
				const e2 = 2 * err;
				if (e2 > -dy) {
					err -= dy;
					cx += sx;
				}
				if (e2 < dx) {
					err += dx;
					cy += sy;
				}
			}
			return new Int32Array(result);
		},
		rectangleOutline(x0, y0, x1, y1) {
			const minX = Math.min(x0, x1);
			const maxX = Math.max(x0, x1);
			const minY = Math.min(y0, y1);
			const maxY = Math.max(y0, y1);
			const pts: number[] = [];
			for (let x = minX; x <= maxX; x++) {
				pts.push(x, minY);
				if (maxY !== minY) pts.push(x, maxY);
			}
			for (let y = minY + 1; y < maxY; y++) {
				pts.push(minX, y);
				if (maxX !== minX) pts.push(maxX, y);
			}
			return new Int32Array(pts);
		},
		ellipseOutline() {
			throw new Error(
				'createInMemoryDrawingOps.ellipseOutline: not implemented; tests that exercise ellipses should use the WASM backend.'
			);
		}
	};

	return ops;
}

export interface FakeCanvasBackendOptions {
	readonly canvasFactory?: CanvasFactory;
	readonly canvasConstraints?: CanvasConstraints;
	readonly viewportOps?: ViewportOps;
	readonly createHistoryManager?: () => HistoryManager;
	readonly createDrawingOps?: (getCanvas: () => PixelCanvas) => DrawingOps;
}

/**
 * Build a `CanvasBackend` composed entirely from pure-TypeScript fakes.
 * Overrides let tests stub individual sub-ports — e.g. pass
 * `{ viewportOps: customOps }` to control camera math without touching the
 * default canvas/history/drawing-ops behavior.
 */
export function createFakeCanvasBackend(options: FakeCanvasBackendOptions = {}): CanvasBackend {
	return {
		canvasFactory: options.canvasFactory ?? fakeCanvasFactory,
		canvasConstraints: options.canvasConstraints ?? fakeCanvasConstraints,
		viewportOps: options.viewportOps ?? fakeViewportOps,
		createHistoryManager: options.createHistoryManager ?? createInMemoryHistoryManager,
		createDrawingOps: options.createDrawingOps ?? createInMemoryDrawingOps
	};
}
