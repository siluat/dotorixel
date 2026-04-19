import type { PixelCanvas } from './canvas-model';
import type { Color } from './color';
import type { DrawingOps, DrawingToolType } from './drawing-ops';

export const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };
export const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
export const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

export function colorsEqual(a: Color, b: Color): boolean {
	return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

export interface FakeDrawingOps extends DrawingOps {
	readonly snapshot: () => Map<string, Color>;
}

/**
 * In-memory DrawingOps for unit tests. Initial pixel color is `initial`;
 * pencil writes the requested color, eraser writes transparent. Out-of-bounds
 * writes are dropped. `applyStroke` models each pixel pair as an independent
 * `applyTool` — no Bresenham interpolation, no dedup. Geometry helpers
 * (`interpolatePixels`, `rectangleOutline`, `ellipseOutline`) stay
 * unimplemented; tests that need them should stub via mocks.
 */
export function createFakeDrawingOps(
	width: number,
	height: number,
	initial: Color
): FakeDrawingOps {
	const pixels = new Map<string, Color>();
	const key = (x: number, y: number) => `${x},${y}`;
	const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
	const colorFor = (kind: DrawingToolType, color: Color): Color =>
		kind === 'eraser' ? TRANSPARENT : color;

	function applyToolImpl(x: number, y: number, kind: DrawingToolType, color: Color): boolean {
		if (!inBounds(x, y)) return false;
		const before = pixels.get(key(x, y)) ?? initial;
		const after = colorFor(kind, color);
		if (colorsEqual(before, after)) return false;
		pixels.set(key(x, y), after);
		return true;
	}

	return {
		applyTool: applyToolImpl,
		setPixel(x, y, color) {
			if (!inBounds(x, y)) return false;
			pixels.set(key(x, y), color);
			return true;
		},
		getPixel(x, y) {
			if (!inBounds(x, y)) return null;
			return pixels.get(key(x, y)) ?? initial;
		},
		applyStroke(points, kind, color) {
			let changed = false;
			for (let i = 0; i + 1 < points.length; i += 2) {
				if (applyToolImpl(points[i], points[i + 1], kind, color)) changed = true;
			}
			return changed;
		},
		floodFill: () => false,
		interpolatePixels: () => new Int32Array(),
		rectangleOutline: () => new Int32Array(),
		ellipseOutline: () => new Int32Array(),
		snapshot: () => new Map(pixels)
	};
}

export interface FakePixelCanvas extends PixelCanvas {
	/** Every `Uint8Array` passed to `restore_pixels`, in call order. */
	readonly restoreCalls: ReadonlyArray<Uint8Array>;
}

/**
 * In-memory PixelCanvas stub for session tests. Tracks every `restore_pixels`
 * call so tests can assert snapshot-restore behavior without a WASM canvas.
 * `encode_png`/`encode_svg`/`resize` throw to flag misuse — extend as needed.
 */
export function createFakePixelCanvas(width: number, height: number): FakePixelCanvas {
	const state = new Uint8Array(width * height * 4);
	const restoreCalls: Uint8Array[] = [];
	return {
		width,
		height,
		pixels: () => new Uint8Array(state),
		get_pixel: () => ({ r: 0, g: 0, b: 0, a: 0 }),
		restore_pixels(data) {
			restoreCalls.push(new Uint8Array(data));
			state.set(data);
		},
		is_inside_bounds: (x, y) => x >= 0 && y >= 0 && x < width && y < height,
		clear() {
			state.fill(0);
		},
		encode_png: () => {
			throw new Error('createFakePixelCanvas: encode_png not implemented');
		},
		encode_svg: () => {
			throw new Error('createFakePixelCanvas: encode_svg not implemented');
		},
		resize: () => {
			throw new Error('createFakePixelCanvas: resize not implemented');
		},
		get restoreCalls() {
			return restoreCalls;
		}
	};
}
