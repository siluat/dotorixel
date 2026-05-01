import { describe, it, expect } from 'vitest';
import { computeDropPlacement } from './compute-drop-placement';

describe('computeDropPlacement', () => {
	it('centers the window on the drop point when there is room on every side', () => {
		const result = computeDropPlacement({
			naturalWidth: 100,
			naturalHeight: 100,
			viewportWidth: 1000,
			viewportHeight: 1000,
			dropX: 500,
			dropY: 500
		});

		expect(result).toEqual({ x: 450, y: 450, width: 100, height: 100 });
	});

	it('shrinks longer edge to viewport longer × 0.3 (sizing parity with computeInitialPlacement)', () => {
		const result = computeDropPlacement({
			naturalWidth: 2000,
			naturalHeight: 1000,
			viewportWidth: 1000,
			viewportHeight: 1000,
			dropX: 500,
			dropY: 500
		});

		expect(result.width).toBe(300);
		expect(result.height).toBe(150);
	});

	it('scales up so the shorter edge is ≥ 80, preserving aspect', () => {
		const result = computeDropPlacement({
			naturalWidth: 10,
			naturalHeight: 100,
			viewportWidth: 1000,
			viewportHeight: 1000,
			dropX: 500,
			dropY: 500
		});

		expect(result.width).toBe(80);
		expect(result.height).toBe(800);
	});

	it('clamps to viewport when the drop point is at the top-left corner', () => {
		const result = computeDropPlacement({
			naturalWidth: 100,
			naturalHeight: 100,
			viewportWidth: 1000,
			viewportHeight: 1000,
			dropX: 0,
			dropY: 0
		});

		expect(result).toEqual({ x: 0, y: 0, width: 100, height: 100 });
	});

	it('clamps to viewport when the drop point is at the bottom-right corner', () => {
		const result = computeDropPlacement({
			naturalWidth: 100,
			naturalHeight: 100,
			viewportWidth: 1000,
			viewportHeight: 1000,
			dropX: 1000,
			dropY: 1000
		});

		expect(result).toEqual({ x: 900, y: 900, width: 100, height: 100 });
	});
});
