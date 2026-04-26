import { describe, it, expect } from 'vitest';
import { computeInitialPlacement } from './compute-initial-placement';

describe('computeInitialPlacement', () => {
	it('returns natural dimensions when natural fits within viewport × 0.3', () => {
		const result = computeInitialPlacement({
			naturalWidth: 100,
			naturalHeight: 100,
			viewportWidth: 1000,
			viewportHeight: 1000,
			cascadeIndex: 0
		});

		expect(result).toEqual({ x: 450, y: 450, width: 100, height: 100 });
	});

	it('shrinks longer edge to viewport longer × 0.3, preserving aspect', () => {
		const result = computeInitialPlacement({
			naturalWidth: 2000,
			naturalHeight: 1000,
			viewportWidth: 1000,
			viewportHeight: 1000,
			cascadeIndex: 0
		});

		expect(result).toEqual({ x: 350, y: 425, width: 300, height: 150 });
	});

	it('scales up so the shorter edge is ≥ 80, preserving aspect', () => {
		const result = computeInitialPlacement({
			naturalWidth: 10,
			naturalHeight: 100,
			viewportWidth: 1000,
			viewportHeight: 1000,
			cascadeIndex: 0
		});

		expect(result).toEqual({ x: 460, y: 100, width: 80, height: 800 });
	});

	it('offsets by cascadeIndex × 24 down-right from center', () => {
		const result = computeInitialPlacement({
			naturalWidth: 100,
			naturalHeight: 100,
			viewportWidth: 1000,
			viewportHeight: 1000,
			cascadeIndex: 2
		});

		expect(result).toEqual({ x: 498, y: 498, width: 100, height: 100 });
	});

	it('clamps the placement so the window stays inside the viewport', () => {
		const result = computeInitialPlacement({
			naturalWidth: 100,
			naturalHeight: 100,
			viewportWidth: 1000,
			viewportHeight: 1000,
			cascadeIndex: 20
		});

		expect(result).toEqual({ x: 900, y: 900, width: 100, height: 100 });
	});

	it('caps the size to the viewport when the 80px floor would otherwise overflow', () => {
		const result = computeInitialPlacement({
			naturalWidth: 2000,
			naturalHeight: 100,
			viewportWidth: 360,
			viewportHeight: 500,
			cascadeIndex: 0
		});

		expect(result.width).toBeLessThanOrEqual(360);
		expect(result.height).toBeLessThanOrEqual(500);
		expect(result.width).toBe(360);
		expect(result.height).toBeCloseTo(18, 5);
		expect(result.x).toBe(0);
		expect(result.y).toBeCloseTo((500 - 18) / 2, 5);
	});

	it('caps the size to the viewport for tall narrow images on small viewports', () => {
		const result = computeInitialPlacement({
			naturalWidth: 100,
			naturalHeight: 2000,
			viewportWidth: 360,
			viewportHeight: 500,
			cascadeIndex: 0
		});

		expect(result.width).toBeLessThanOrEqual(360);
		expect(result.height).toBeLessThanOrEqual(500);
		expect(result.height).toBe(500);
		expect(result.width).toBeCloseTo(25, 5);
	});
});
