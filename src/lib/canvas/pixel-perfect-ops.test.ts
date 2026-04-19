import { describe, it, expect } from 'vitest';
import { createPixelPerfectOps } from './pixel-perfect-ops';
import { BLACK, WHITE, createFakeDrawingOps } from './fake-drawing-ops';

const createFakeOps = createFakeDrawingOps;

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
