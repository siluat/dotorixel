import type { Color } from '../../color';
import type { SamplingPort } from '../ports';

const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

/**
 * In-memory `SamplingPort` for unit tests. `grid[y][x]` is the pixel at
 * coordinate `(x, y)`. `null` cells are returned as fully transparent —
 * the port itself is bounds-trusting per its contract; out-of-bounds
 * handling is the caller's job (see `sample-grid.ts`).
 */
export function createInMemorySamplingPort(grid: (Color | null)[][]): SamplingPort {
	const height = grid.length;
	const width = height === 0 ? 0 : grid[0].length;
	return {
		width,
		height,
		get_pixel(x, y) {
			return grid[y][x] ?? TRANSPARENT;
		}
	};
}
