import { describe, it, expect } from 'vitest';
import { sampleGrid } from './sample-grid';
import { canvasFactory } from './wasm-backend';
import type { Color } from './color';

const RED: Color = { r: 255, g: 0, b: 0, a: 255 };

/** Encode a row-major array of Colors into the Uint8Array shape that `fromPixels` expects. */
function encodePixels(colors: Color[]): Uint8Array {
	const bytes = new Uint8Array(colors.length * 4);
	colors.forEach((c, i) => {
		bytes[i * 4 + 0] = c.r;
		bytes[i * 4 + 1] = c.g;
		bytes[i * 4 + 2] = c.b;
		bytes[i * 4 + 3] = c.a;
	});
	return bytes;
}

describe('sampleGrid', () => {
	it('returns a 9×9 grid of the canvas color when the canvas is a uniform fill', () => {
		const canvas = canvasFactory.withColor(16, 16, RED);

		const grid = sampleGrid(canvas, { x: 8, y: 8 }, 9);

		expect(grid).toHaveLength(81);
		for (const cell of grid) {
			expect(cell).toEqual(RED);
		}
	});

	it('clamps to edge pixels when the grid extends beyond the canvas', () => {
		// 2×2 canvas; unique color per pixel.
		const TL: Color = { r: 10, g: 0, b: 0, a: 255 };
		const TR: Color = { r: 20, g: 0, b: 0, a: 255 };
		const BL: Color = { r: 30, g: 0, b: 0, a: 255 };
		const BR: Color = { r: 40, g: 0, b: 0, a: 255 };
		const canvas = canvasFactory.fromPixels(2, 2, encodePixels([TL, TR, BL, BR]));

		// 3×3 grid centered at (0, 0) — out-of-canvas cells clamp to the nearest edge.
		const grid = sampleGrid(canvas, { x: 0, y: 0 }, 3);

		// Expected row-major:
		//   (-1,-1)→TL  (0,-1)→TL  (1,-1)→TR
		//   (-1, 0)→TL  (0, 0)→TL  (1, 0)→TR
		//   (-1, 1)→BL  (0, 1)→BL  (1, 1)→BR
		expect(grid).toEqual([
			TL, TL, TR,
			TL, TL, TR,
			BL, BL, BR
		]);
	});

	it('samples each cell independently, producing a row-major grid matching the source pixels', () => {
		// 3×3 canvas, one unique color per pixel, so each sampled cell is distinguishable.
		const pixels = [
			{ r: 10, g: 0, b: 0, a: 255 }, { r: 20, g: 0, b: 0, a: 255 }, { r: 30, g: 0, b: 0, a: 255 },
			{ r: 40, g: 0, b: 0, a: 255 }, { r: 50, g: 0, b: 0, a: 255 }, { r: 60, g: 0, b: 0, a: 255 },
			{ r: 70, g: 0, b: 0, a: 255 }, { r: 80, g: 0, b: 0, a: 255 }, { r: 90, g: 0, b: 0, a: 255 }
		];
		const canvas = canvasFactory.fromPixels(3, 3, encodePixels(pixels));

		const grid = sampleGrid(canvas, { x: 1, y: 1 }, 3);

		expect(grid).toEqual(pixels);
	});
});
