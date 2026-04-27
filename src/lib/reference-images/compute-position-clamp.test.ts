import { describe, it, expect } from 'vitest';
import { clampPosition } from './compute-position-clamp';

describe('clampPosition', () => {
	it('returns the position unchanged when the window already fits inside the viewport', () => {
		const result = clampPosition({
			x: 100,
			y: 80,
			width: 200,
			height: 150,
			viewportWidth: 1000,
			viewportHeight: 800
		});

		expect(result).toEqual({ x: 100, y: 80 });
	});

	it('snaps a window dragged off the right or bottom edge back inside the viewport', () => {
		const result = clampPosition({
			x: 900,
			y: 700,
			width: 200,
			height: 150,
			viewportWidth: 1000,
			viewportHeight: 800
		});

		expect(result).toEqual({ x: 800, y: 650 });
	});

	it('snaps a window dragged past the top or left edge back to the origin', () => {
		const result = clampPosition({
			x: -50,
			y: -30,
			width: 200,
			height: 150,
			viewportWidth: 1000,
			viewportHeight: 800
		});

		expect(result).toEqual({ x: 0, y: 0 });
	});

	it('places oversized windows at the origin so the title bar stays grabbable', () => {
		const result = clampPosition({
			x: 100,
			y: 100,
			width: 1500,
			height: 1200,
			viewportWidth: 1000,
			viewportHeight: 800
		});

		expect(result).toEqual({ x: 0, y: 0 });
	});
});
