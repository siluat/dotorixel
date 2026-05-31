import { describe, expect, it } from 'vitest';
import { BLACK, WHITE, createFakeDrawingOps } from './fake-drawing-ops';
import { createMarqueeClippedOps } from './drawing-ops';

function marquee(x: number, y: number, width: number, height: number) {
	return { x, y, width, height };
}

describe('createMarqueeClippedOps', () => {
	it('returns the base ops when no Marquee is active', () => {
		const base = createFakeDrawingOps(4, 4, WHITE);

		expect(createMarqueeClippedOps(base, null)).toBe(base);
		expect(createMarqueeClippedOps(base, undefined)).toBe(base);
	});

	it('lets setPixel write inside the Marquee and drops writes outside', () => {
		const base = createFakeDrawingOps(4, 4, WHITE);
		const ops = createMarqueeClippedOps(base, marquee(1, 1, 2, 2));

		expect(ops.setPixel(1, 1, BLACK)).toBe(true);
		expect(ops.setPixel(0, 0, BLACK)).toBe(false);

		expect(base.getPixel(1, 1)).toEqual(BLACK);
		expect(base.getPixel(0, 0)).toEqual(WHITE);
	});

	it('lets applyTool write inside the Marquee and drops writes outside', () => {
		const base = createFakeDrawingOps(4, 4, WHITE);
		const ops = createMarqueeClippedOps(base, marquee(1, 1, 2, 2));

		expect(ops.applyTool(2, 2, 'pencil', BLACK)).toBe(true);
		expect(ops.applyTool(3, 3, 'pencil', BLACK)).toBe(false);

		expect(base.getPixel(2, 2)).toEqual(BLACK);
		expect(base.getPixel(3, 3)).toEqual(WHITE);
	});

	it('filters applyStroke batches to Marquee coordinates before forwarding', () => {
		const base = createFakeDrawingOps(4, 4, WHITE);
		const ops = createMarqueeClippedOps(base, marquee(1, 1, 2, 2));

		expect(ops.applyStroke(new Int32Array([0, 0, 1, 1, 2, 2, 3, 3]), 'pencil', BLACK)).toBe(
			true
		);

		expect(base.getPixel(0, 0)).toEqual(WHITE);
		expect(base.getPixel(1, 1)).toEqual(BLACK);
		expect(base.getPixel(2, 2)).toEqual(BLACK);
		expect(base.getPixel(3, 3)).toEqual(WHITE);
	});

	it('limits floodFill to connected pixels inside the Marquee', () => {
		const base = createFakeDrawingOps(4, 4, WHITE);
		const ops = createMarqueeClippedOps(base, marquee(1, 1, 2, 2));

		expect(ops.floodFill(1, 1, BLACK)).toBe(true);

		expect(base.getPixel(0, 1)).toEqual(WHITE);
		expect(base.getPixel(1, 1)).toEqual(BLACK);
		expect(base.getPixel(2, 1)).toEqual(BLACK);
		expect(base.getPixel(1, 2)).toEqual(BLACK);
		expect(base.getPixel(2, 2)).toEqual(BLACK);
		expect(base.getPixel(3, 2)).toEqual(WHITE);
	});

	it('drops floodFill when the seed is outside the Marquee', () => {
		const base = createFakeDrawingOps(4, 4, WHITE);
		const ops = createMarqueeClippedOps(base, marquee(1, 1, 2, 2));

		expect(ops.floodFill(0, 0, BLACK)).toBe(false);

		expect(base.getPixel(0, 0)).toEqual(WHITE);
		expect(base.getPixel(1, 1)).toEqual(WHITE);
	});
});
