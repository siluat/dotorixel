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
 * writes are dropped. Stroke methods (`applyStroke`, `interpolatePixels`,
 * `rectangleOutline`, `ellipseOutline`) are unimplemented — tests that need
 * them should wrap this fake with the subject under test (e.g. the
 * pixel-perfect decorator).
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

	return {
		applyTool(x, y, kind, color) {
			if (!inBounds(x, y)) return false;
			const before = pixels.get(key(x, y)) ?? initial;
			const after = colorFor(kind, color);
			if (colorsEqual(before, after)) return false;
			pixels.set(key(x, y), after);
			return true;
		},
		setPixel(x, y, color) {
			if (!inBounds(x, y)) return false;
			pixels.set(key(x, y), color);
			return true;
		},
		getPixel(x, y) {
			if (!inBounds(x, y)) return null;
			return pixels.get(key(x, y)) ?? initial;
		},
		applyStroke() {
			throw new Error('createFakeDrawingOps: applyStroke is not implemented; wrap with the subject under test');
		},
		floodFill: () => false,
		interpolatePixels: () => new Int32Array(),
		rectangleOutline: () => new Int32Array(),
		ellipseOutline: () => new Int32Array(),
		snapshot: () => new Map(pixels)
	};
}
