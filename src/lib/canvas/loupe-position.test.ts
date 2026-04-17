import { describe, it, expect } from 'vitest';
import { computeLoupePosition, type Quadrant } from './loupe-position';

describe('computeLoupePosition — mouse', () => {
	it('places the loupe in the top-right quadrant at a fixed offset when the pointer is in the viewport center', () => {
		const result = computeLoupePosition({
			pointer: { x: 600, y: 400 },
			viewport: { width: 1200, height: 800 },
			loupe: { width: 240, height: 290 },
			mouseOffset: 20,
			touchOffset: 80,
			inputSource: 'mouse'
		});

		expect(result).toEqual({
			x: 600 + 20,
			y: 400 - 290 - 20,
			quadrant: 'tr'
		});
	});

	it('flips horizontally to the top-left quadrant when the default position would clip the viewport right edge', () => {
		const result = computeLoupePosition({
			pointer: { x: 1180, y: 400 },
			viewport: { width: 1200, height: 800 },
			loupe: { width: 240, height: 290 },
			mouseOffset: 20,
			touchOffset: 80,
			inputSource: 'mouse'
		});

		expect(result).toEqual({
			x: 1180 - 240 - 20,
			y: 400 - 290 - 20,
			quadrant: 'tl'
		});
	});

	it('flips vertically to the bottom-right quadrant when the default position would clip the viewport top edge', () => {
		const result = computeLoupePosition({
			pointer: { x: 600, y: 100 },
			viewport: { width: 1200, height: 800 },
			loupe: { width: 240, height: 290 },
			mouseOffset: 20,
			touchOffset: 80,
			inputSource: 'mouse'
		});

		expect(result).toEqual({
			x: 600 + 20,
			y: 100 + 20,
			quadrant: 'br'
		});
	});

	it('flips both axes to the bottom-left quadrant when the default position would clip both top and right edges', () => {
		const result = computeLoupePosition({
			pointer: { x: 1180, y: 100 },
			viewport: { width: 1200, height: 800 },
			loupe: { width: 240, height: 290 },
			mouseOffset: 20,
			touchOffset: 80,
			inputSource: 'mouse'
		});

		expect(result).toEqual({
			x: 1180 - 240 - 20,
			y: 100 + 20,
			quadrant: 'bl'
		});
	});
});

describe('computeLoupePosition — touch', () => {
	it('centers the loupe horizontally and places it above the pointer when there is room', () => {
		const result = computeLoupePosition({
			pointer: { x: 600, y: 400 },
			viewport: { width: 1200, height: 800 },
			loupe: { width: 240, height: 290 },
			mouseOffset: 20,
			touchOffset: 80,
			inputSource: 'touch'
		});

		expect(result).toEqual({
			x: 600 - 240 / 2,
			y: 400 - 290 - 80,
			quadrant: 'tr'
		});
	});

	it('flips vertically to bottom-right when the centered-above position would clip the top edge', () => {
		const result = computeLoupePosition({
			pointer: { x: 600, y: 100 },
			viewport: { width: 1200, height: 800 },
			loupe: { width: 240, height: 290 },
			mouseOffset: 20,
			touchOffset: 80,
			inputSource: 'touch'
		});

		expect(result).toEqual({
			x: 600 - 240 / 2,
			y: 100 + 80,
			quadrant: 'br'
		});
	});

	it('clamps the loupe to the viewport left edge instead of flipping when the centered position would clip left', () => {
		const result = computeLoupePosition({
			pointer: { x: 50, y: 400 },
			viewport: { width: 1200, height: 800 },
			loupe: { width: 240, height: 290 },
			mouseOffset: 20,
			touchOffset: 80,
			inputSource: 'touch'
		});

		// Centered-above x would be 50 - 120 = -70 (off-screen). Clamp to 0
		// — keeps the loupe visible without flipping its horizontal axis.
		expect(result).toEqual({
			x: 0,
			y: 400 - 290 - 80,
			quadrant: 'tr'
		});
	});

	it('clamps the loupe to the viewport right edge instead of flipping when the centered position would clip right', () => {
		const result = computeLoupePosition({
			pointer: { x: 1180, y: 400 },
			viewport: { width: 1200, height: 800 },
			loupe: { width: 240, height: 290 },
			mouseOffset: 20,
			touchOffset: 80,
			inputSource: 'touch'
		});

		// Centered-above x would be 1180 - 120 = 1060; right edge at 1300 clips.
		// Clamp to viewport.width - loupe.width = 960.
		expect(result).toEqual({
			x: 1200 - 240,
			y: 400 - 290 - 80,
			quadrant: 'tr'
		});
	});
});

// Sweep across the 9 reference pointer positions (4 corners, 4 edge midpoints,
// center) for both input sources. Catches any regression that a future change
// to the quadrant-flip or clamp logic might introduce at a position that
// isn't covered by an above behavior-focused test.
describe('computeLoupePosition — quadrant table sweep', () => {
	const VIEWPORT = { width: 1200, height: 800 };
	const LOUPE = { width: 240, height: 290 };
	const MOUSE_OFFSET = 20;
	const TOUCH_OFFSET = 80;

	const cases: ReadonlyArray<{
		readonly position: string;
		readonly pointer: { x: number; y: number };
		readonly mouseQuadrant: Quadrant;
		readonly touchQuadrant: Quadrant;
	}> = [
		{ position: 'center',           pointer: { x: 600,  y: 400 }, mouseQuadrant: 'tr', touchQuadrant: 'tr' },
		{ position: 'top edge',         pointer: { x: 600,  y: 100 }, mouseQuadrant: 'br', touchQuadrant: 'br' },
		{ position: 'right edge',       pointer: { x: 1180, y: 400 }, mouseQuadrant: 'tl', touchQuadrant: 'tr' },
		{ position: 'bottom edge',      pointer: { x: 600,  y: 750 }, mouseQuadrant: 'tr', touchQuadrant: 'tr' },
		{ position: 'left edge',        pointer: { x: 50,   y: 400 }, mouseQuadrant: 'tr', touchQuadrant: 'tr' },
		{ position: 'top-left corner',  pointer: { x: 50,   y: 100 }, mouseQuadrant: 'br', touchQuadrant: 'br' },
		{ position: 'top-right corner', pointer: { x: 1180, y: 100 }, mouseQuadrant: 'bl', touchQuadrant: 'br' },
		{ position: 'bottom-left corner',  pointer: { x: 50,   y: 750 }, mouseQuadrant: 'tr', touchQuadrant: 'tr' },
		{ position: 'bottom-right corner', pointer: { x: 1180, y: 750 }, mouseQuadrant: 'tl', touchQuadrant: 'tr' }
	];

	for (const c of cases) {
		it(`places mouse at ${c.position} → ${c.mouseQuadrant}`, () => {
			const result = computeLoupePosition({
				pointer: c.pointer,
				viewport: VIEWPORT,
				loupe: LOUPE,
				mouseOffset: MOUSE_OFFSET,
				touchOffset: TOUCH_OFFSET,
				inputSource: 'mouse'
			});

			expect(result.quadrant).toBe(c.mouseQuadrant);
			expect(result.x).toBeGreaterThanOrEqual(0);
			expect(result.x + LOUPE.width).toBeLessThanOrEqual(VIEWPORT.width);
			expect(result.y).toBeGreaterThanOrEqual(0);
			expect(result.y + LOUPE.height).toBeLessThanOrEqual(VIEWPORT.height);
		});

		it(`places touch at ${c.position} → ${c.touchQuadrant}`, () => {
			const result = computeLoupePosition({
				pointer: c.pointer,
				viewport: VIEWPORT,
				loupe: LOUPE,
				mouseOffset: MOUSE_OFFSET,
				touchOffset: TOUCH_OFFSET,
				inputSource: 'touch'
			});

			expect(result.quadrant).toBe(c.touchQuadrant);
			expect(result.x).toBeGreaterThanOrEqual(0);
			expect(result.x + LOUPE.width).toBeLessThanOrEqual(VIEWPORT.width);
			expect(result.y).toBeGreaterThanOrEqual(0);
			expect(result.y + LOUPE.height).toBeLessThanOrEqual(VIEWPORT.height);
		});
	}
});
