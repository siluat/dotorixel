import { describe, it, expect } from 'vitest';
import { createPixelPerfectOps } from './pixel-perfect-ops';
import { BLACK, WHITE, createFakeDrawingOps } from './fake-drawing-ops';

// Residue unit tests — filter-level invariants not observable at the
// stroke-session boundary. L-corner revert, first-touch cache, and the
// Bresenham shared-junction seam are covered by stroke-session.continuous
// through natural `draw(current, previous)` sequences; only the
// non-Bresenham cross-batch pattern below exercises the wrapper directly.

describe('createPixelPerfectOps', () => {
	it('detects an L-corner that spans across applyStroke calls without seam duplicates', () => {
		// Non-pencil callers that feed the wrapper contiguous batches (no shared
		// junction pixel) must still see L-corner detection across the seam —
		// the filter's tail state carries the triple-window across calls.
		const base = createFakeDrawingOps(8, 8, WHITE);
		const pp = createPixelPerfectOps(base);

		pp.applyStroke(new Int32Array([0, 0, 1, 0]), 'pencil', BLACK);
		pp.applyStroke(new Int32Array([1, 1]), 'pencil', BLACK);

		expect(base.getPixel(0, 0)).toEqual(BLACK);
		expect(base.getPixel(1, 0)).toEqual(WHITE);
		expect(base.getPixel(1, 1)).toEqual(BLACK);
	});
});
