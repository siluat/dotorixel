import { WasmActionKind, wasm_pixel_perfect_filter } from '$wasm/dotorixel_wasm';
import type { DrawingOps, DrawingToolType } from './drawing-ops';
import type { Color } from './color';

/**
 * Wraps a `DrawingOps` so that `applyStroke` runs each batch through the
 * Aseprite-style pixel-perfect filter. L-corner middle pixels are reverted to
 * their pre-stroke color as soon as the corner is detected.
 *
 * The wrapper is a stroke-scoped decorator: callers create one at `drawStart`,
 * use it for every `applyStroke` during the stroke, and drop it at `drawEnd`.
 * State (tail + pre-paint cache) is per-instance, so each stroke gets a fresh
 * cache that captures pixels as they were before the stroke began.
 *
 * The cache is first-touch-wins — if a coordinate is repainted within the same
 * stroke, the original pre-stroke color is preserved.
 *
 * Non-stroke methods (`applyTool`, `setPixel`, `floodFill`, geometry helpers)
 * forward directly to the base ops without touching the cache.
 */
export function createPixelPerfectOps(baseOps: DrawingOps): DrawingOps {
	let tail: Int32Array<ArrayBufferLike> = new Int32Array();
	const cache = new Map<string, Color>();
	const key = (x: number, y: number) => `${x},${y}`;

	/**
	 * Drops any pixel that equals the immediately preceding pixel (carrying
	 * across the tail seam). Pencil-tool's Bresenham segments include both
	 * endpoints, so successive batches share a junction pixel — left in, the
	 * duplicate would put `cur == next` in the WASM filter's 3-window and
	 * silently suppress L-corner detection at the seam.
	 */
	function dedupAgainstTail(pixels: Int32Array): Int32Array {
		let prev: { x: number; y: number } | null =
			tail.length >= 2 ? { x: tail[tail.length - 2], y: tail[tail.length - 1] } : null;
		const out: number[] = [];
		for (let i = 0; i < pixels.length; i += 2) {
			const x = pixels[i];
			const y = pixels[i + 1];
			if (prev !== null && x === prev.x && y === prev.y) continue;
			out.push(x, y);
			prev = { x, y };
		}
		return new Int32Array(out);
	}

	function applyStroke(pixels: Int32Array, tool: DrawingToolType, color: Color): boolean {
		const deduped = dedupAgainstTail(pixels);
		if (deduped.length === 0) return false;
		const result = wasm_pixel_perfect_filter(deduped, tail);
		tail = result.new_tail_flat();
		const actions = result.actions_flat();

		let changed = false;
		for (let i = 0; i < actions.length; i += 3) {
			const kind = actions[i];
			const x = actions[i + 1];
			const y = actions[i + 2];
			const k = key(x, y);

			if (kind === WasmActionKind.Paint) {
				if (!cache.has(k)) {
					const prev = baseOps.getPixel(x, y);
					if (prev !== null) cache.set(k, prev);
				}
				if (baseOps.applyTool(x, y, tool, color)) changed = true;
			} else {
				const prev = cache.get(k);
				if (prev && baseOps.setPixel(x, y, prev)) changed = true;
			}
		}
		return changed;
	}

	return {
		applyStroke,
		applyTool: baseOps.applyTool.bind(baseOps),
		setPixel: baseOps.setPixel.bind(baseOps),
		getPixel: baseOps.getPixel.bind(baseOps),
		floodFill: baseOps.floodFill.bind(baseOps),
		interpolatePixels: baseOps.interpolatePixels.bind(baseOps),
		rectangleOutline: baseOps.rectangleOutline.bind(baseOps),
		ellipseOutline: baseOps.ellipseOutline.bind(baseOps)
	};
}
