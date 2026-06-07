import { describe, it, expect } from 'vitest';
import { navigationBounds } from './navigation-bounds';

describe('navigationBounds', () => {
	it('returns the canvas rectangle when there is no Reference footprint', () => {
		expect(navigationBounds({ width: 16, height: 24 }, null)).toEqual({
			minX: 0,
			minY: 0,
			maxX: 16,
			maxY: 24
		});
	});

	it('expands to the union when the Reference footprint extends beyond the canvas', () => {
		expect(
			navigationBounds({ width: 16, height: 16 }, { minX: -5, minY: 2, maxX: 40, maxY: 12 })
		).toEqual({ minX: -5, minY: 0, maxX: 40, maxY: 16 });
	});

	it('returns the canvas rectangle when the Reference footprint lies inside it', () => {
		expect(
			navigationBounds({ width: 16, height: 16 }, { minX: 2, minY: 2, maxX: 10, maxY: 10 })
		).toEqual({ minX: 0, minY: 0, maxX: 16, maxY: 16 });
	});
});
