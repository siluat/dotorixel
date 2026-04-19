import { describe, it, expect } from 'vitest';
import {
	WasmActionKind,
	WasmFilterResult,
	wasm_pixel_perfect_filter,
} from '$wasm/dotorixel_wasm';

describe('wasm_pixel_perfect_filter', () => {
	it('exports the WasmFilterResult class and filter function', () => {
		expect(typeof wasm_pixel_perfect_filter).toBe('function');
		expect(WasmFilterResult).toBeDefined();
	});

	it('returns Paint actions for a collinear 3-point path with no Revert', () => {
		const points = new Int32Array([0, 0, 1, 0, 2, 0]);
		const prevTail = new Int32Array([]);
		const result = wasm_pixel_perfect_filter(points, prevTail);

		const actions = result.actions_flat();
		expect(actions).toBeInstanceOf(Int32Array);
		// 3 Paint actions × 3 ints each = 9 entries; no Revert.
		expect(actions.length).toBe(9);
		for (let i = 0; i < actions.length; i += 3) {
			expect(actions[i]).toBe(WasmActionKind.Paint);
		}

		const tail = result.new_tail_flat();
		expect(Array.from(tail)).toEqual([1, 0, 2, 0]);
	});

	it('emits a Revert for the middle of an L-corner', () => {
		const points = new Int32Array([0, 0, 1, 0, 1, 1]);
		const result = wasm_pixel_perfect_filter(points, new Int32Array([]));
		const actions = Array.from(result.actions_flat());

		const P = WasmActionKind.Paint;
		const R = WasmActionKind.Revert;
		// 3 Paints in input order, followed by 1 Revert for the L-corner tip (1,0).
		expect(actions).toEqual([P, 0, 0, P, 1, 0, P, 1, 1, R, 1, 0]);
	});

	it('rejects odd-length points arrays', () => {
		expect(() =>
			wasm_pixel_perfect_filter(new Int32Array([1, 2, 3]), new Int32Array([])),
		).toThrow();
	});

	it('rejects prev_tail lengths other than 0, 2, or 4', () => {
		expect(() =>
			wasm_pixel_perfect_filter(new Int32Array([]), new Int32Array([1])),
		).toThrow();
		expect(() =>
			wasm_pixel_perfect_filter(
				new Int32Array([]),
				new Int32Array([1, 2, 3]),
			),
		).toThrow();
	});
});
