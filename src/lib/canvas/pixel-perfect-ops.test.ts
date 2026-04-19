import { describe, it, expect } from 'vitest';
import { createPixelPerfectOps } from './pixel-perfect-ops';
import type { DrawingOps, DrawingToolType } from './drawing-ops';
import type { Color } from './color';

const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };
const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

function colorsEqual(a: Color, b: Color): boolean {
	return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

interface FakeOps extends DrawingOps {
	readonly snapshot: () => Map<string, Color>;
}

/**
 * In-memory DrawingOps for testing the PP decorator.
 * Initial pixel color is `initial`; pencil writes the requested color,
 * eraser writes transparent. Out-of-bounds writes are dropped.
 */
function createFakeOps(width: number, height: number, initial: Color): FakeOps {
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
			throw new Error('Fake baseOps.applyStroke should not be called by PP wrapper');
		},
		floodFill: () => false,
		interpolatePixels: () => new Int32Array(),
		rectangleOutline: () => new Int32Array(),
		ellipseOutline: () => new Int32Array(),
		snapshot: () => new Map(pixels),
	};
}

describe('createPixelPerfectOps', () => {
	it('reverts the L-corner middle pixel to its pre-paint color', () => {
		const base = createFakeOps(8, 8, WHITE);
		const pp = createPixelPerfectOps(base);

		// L-shape: (0,0) → (1,0) → (1,1). The middle (1,0) is the L-corner.
		const points = new Int32Array([0, 0, 1, 0, 1, 1]);
		const changed = pp.applyStroke(points, 'pencil', BLACK);

		expect(changed).toBe(true);
		expect(base.getPixel(0, 0)).toEqual(BLACK);
		expect(base.getPixel(1, 0)).toEqual(WHITE);
		expect(base.getPixel(1, 1)).toEqual(BLACK);
	});

	it('detects an L-corner that spans across applyStroke calls', () => {
		const base = createFakeOps(8, 8, WHITE);
		const pp = createPixelPerfectOps(base);

		// First batch ends with two collinear pixels — no triple yet, so no Revert.
		pp.applyStroke(new Int32Array([0, 0, 1, 0]), 'pencil', BLACK);
		// Second batch contributes the third point of the L. The tail from the
		// previous call lets the filter see the (0,0)(1,0)(1,1) triple and emit
		// Revert(1,0); the wrapper's cache (populated in batch 1) restores WHITE.
		pp.applyStroke(new Int32Array([1, 1]), 'pencil', BLACK);

		expect(base.getPixel(0, 0)).toEqual(BLACK);
		expect(base.getPixel(1, 0)).toEqual(WHITE);
		expect(base.getPixel(1, 1)).toEqual(BLACK);
	});

	it('detects L-corners when batches share an overlapping junction pixel', () => {
		// Pencil-tool emits Bresenham segments that include BOTH endpoints, so
		// successive `applyStroke` calls share a duplicate pixel at the seam.
		// The wrapper must coalesce these duplicates so the WASM filter's
		// 3-window L-detection still fires across the seam.
		const base = createFakeOps(8, 8, WHITE);
		const pp = createPixelPerfectOps(base);

		// Initial drawStart: just the first point.
		pp.applyStroke(new Int32Array([0, 0]), 'pencil', BLACK);
		// First onDraw segment: prev=(0,0), curr=(1,0) → [(0,0), (1,0)].
		pp.applyStroke(new Int32Array([0, 0, 1, 0]), 'pencil', BLACK);
		// Second onDraw segment: prev=(1,0), curr=(1,1) → [(1,0), (1,1)].
		pp.applyStroke(new Int32Array([1, 0, 1, 1]), 'pencil', BLACK);

		expect(base.getPixel(0, 0)).toEqual(BLACK);
		expect(base.getPixel(1, 0)).toEqual(WHITE);
		expect(base.getPixel(1, 1)).toEqual(BLACK);
	});

	it('keeps the first pre-paint color when a coord is revisited within a stroke', () => {
		const base = createFakeOps(8, 8, WHITE);
		const pp = createPixelPerfectOps(base);

		// (1,0) is painted first (cache → WHITE), then revisited after the
		// canvas at (1,0) is already BLACK, then the trailing L-corner
		// (0,0)(1,0)(1,1) emits a Revert(1,0). First-touch-wins means the
		// revert restores WHITE, not BLACK.
		const points = new Int32Array([1, 0, 0, 0, 1, 0, 1, 1]);
		pp.applyStroke(points, 'pencil', BLACK);

		expect(base.getPixel(1, 0)).toEqual(WHITE);
	});
});
