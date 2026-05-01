import { describe, it, expect } from 'vitest';
import {
	commitMove,
	commitResize,
	createPlacement,
	refitPlacement
} from './reference-window-placement';

describe('createPlacement', () => {
	describe('centered intent', () => {
		it('centers the natural-sized image inside the viewport when it fits within viewport × 0.3', () => {
			const result = createPlacement(
				{ width: 100, height: 100 },
				{ kind: 'centered', cascadeIndex: 0 },
				{ width: 1000, height: 1000 }
			);

			expect(result).toEqual({ x: 450, y: 450, width: 100, height: 100 });
		});

		it('shrinks the longer edge to viewport_longer × 0.3 while preserving aspect', () => {
			const result = createPlacement(
				{ width: 2000, height: 1000 },
				{ kind: 'centered', cascadeIndex: 0 },
				{ width: 1000, height: 1000 }
			);

			expect(result).toEqual({ x: 350, y: 425, width: 300, height: 150 });
		});

		it('scales up the shorter edge to MIN_WINDOW_EDGE for thin aspects, preserving aspect', () => {
			const result = createPlacement(
				{ width: 10, height: 100 },
				{ kind: 'centered', cascadeIndex: 0 },
				{ width: 1000, height: 1000 }
			);

			expect(result).toEqual({ x: 460, y: 100, width: 80, height: 800 });
		});

		it('shifts the centered placement down-right by cascadeIndex × CASCADE_OFFSET', () => {
			const result = createPlacement(
				{ width: 100, height: 100 },
				{ kind: 'centered', cascadeIndex: 2 },
				{ width: 1000, height: 1000 }
			);

			expect(result).toEqual({ x: 498, y: 498, width: 100, height: 100 });
		});

		it('clamps the cascade-shifted placement so the window stays inside the viewport', () => {
			const result = createPlacement(
				{ width: 100, height: 100 },
				{ kind: 'centered', cascadeIndex: 20 },
				{ width: 1000, height: 1000 }
			);

			expect(result).toEqual({ x: 900, y: 900, width: 100, height: 100 });
		});

		it('caps the size to the viewport when the MIN_WINDOW_EDGE floor would push past it', () => {
			const result = createPlacement(
				{ width: 2000, height: 100 },
				{ kind: 'centered', cascadeIndex: 0 },
				{ width: 360, height: 500 }
			);

			expect(result.width).toBe(360);
			expect(result.height).toBeCloseTo(18, 5);
			expect(result.x).toBe(0);
			expect(result.y).toBeCloseTo((500 - 18) / 2, 5);
		});
	});

	describe('at-point intent', () => {
		it('centers the window on the supplied point when there is room on every side', () => {
			const result = createPlacement(
				{ width: 100, height: 100 },
				{ kind: 'at-point', x: 300, y: 700 },
				{ width: 1000, height: 1000 }
			);

			expect(result).toEqual({ x: 250, y: 650, width: 100, height: 100 });
		});

		it('clamps to viewport when the point is at the top-left corner', () => {
			const result = createPlacement(
				{ width: 100, height: 100 },
				{ kind: 'at-point', x: 0, y: 0 },
				{ width: 1000, height: 1000 }
			);

			expect(result).toEqual({ x: 0, y: 0, width: 100, height: 100 });
		});

		it('clamps to viewport when the point is at the bottom-right corner', () => {
			const result = createPlacement(
				{ width: 100, height: 100 },
				{ kind: 'at-point', x: 1000, y: 1000 },
				{ width: 1000, height: 1000 }
			);

			expect(result).toEqual({ x: 900, y: 900, width: 100, height: 100 });
		});
	});
});

describe('refitPlacement', () => {
	it('returns a structurally equal placement when the input already fits the viewport', () => {
		const placement = { x: 100, y: 80, width: 200, height: 150 };
		const result = refitPlacement(placement, { width: 1000, height: 800 });

		expect(result).toEqual(placement);
	});

	it('proportionally shrinks the size, preserving aspect, when the viewport is smaller than the placement', () => {
		const placement = { x: 0, y: 0, width: 800, height: 400 };
		const result = refitPlacement(placement, { width: 400, height: 400 });

		expect(result.width).toBeCloseTo(400, 5);
		expect(result.height).toBeCloseTo(200, 5);
		expect(result.width / result.height).toBeCloseTo(800 / 400, 5);
		expect(result.x).toBeGreaterThanOrEqual(0);
		expect(result.y).toBeGreaterThanOrEqual(0);
		expect(result.x + result.width).toBeLessThanOrEqual(400);
		expect(result.y + result.height).toBeLessThanOrEqual(400);
	});
});

describe('commitMove', () => {
	it('snaps a position dragged off the right or bottom edge back inside the viewport, size unchanged', () => {
		const current = { x: 100, y: 100, width: 200, height: 150 };
		const result = commitMove(current, 900, 700, { width: 1000, height: 800 });

		expect(result).toEqual({ x: 800, y: 650, width: 200, height: 150 });
	});

	it('snaps a position dragged past the top or left edge back to the origin', () => {
		const current = { x: 100, y: 100, width: 200, height: 150 };
		const result = commitMove(current, -50, -30, { width: 1000, height: 800 });

		expect(result).toEqual({ x: 0, y: 0, width: 200, height: 150 });
	});
});

describe('commitResize', () => {
	it('preserves a landscape aspect ratio under a uniform corner drag, dominant axis driving', () => {
		const current = { x: 200, y: 200, width: 200, height: 100 };
		const result = commitResize(current, 50, 50, { width: 1000, height: 800 });

		expect(result).toEqual({ x: 200, y: 200, width: 300, height: 150 });
	});

	it('clamps the shrunk size to the MIN_WINDOW_EDGE floor while preserving aspect', () => {
		const current = { x: 200, y: 200, width: 200, height: 100 };
		const result = commitResize(current, -180, -80, { width: 1000, height: 800 });

		expect(result).toEqual({ x: 200, y: 200, width: 160, height: 80 });
	});

	it('caps the size to the viewport upper bound while preserving aspect', () => {
		const current = { x: 0, y: 0, width: 200, height: 100 };
		const result = commitResize(current, 5000, 5000, { width: 600, height: 400 });

		expect(result.width).toBeLessThanOrEqual(600);
		expect(result.height).toBeLessThanOrEqual(400);
		expect(result.width / result.height).toBeCloseTo(2, 5);
		expect(result.width).toBeCloseTo(600, 5);
		expect(result.height).toBeCloseTo(300, 5);
	});

	it('caps the size against the available space from the anchored top-left so the result fits the viewport', () => {
		const current = { x: 400, y: 300, width: 200, height: 100 };
		const result = commitResize(current, 5000, 5000, { width: 1000, height: 800 });

		expect(result.x).toBe(400);
		expect(result.y).toBe(300);
		expect(result.x + result.width).toBeLessThanOrEqual(1000);
		expect(result.y + result.height).toBeLessThanOrEqual(800);
		expect(result.width / result.height).toBeCloseTo(2, 5);
	});
});
