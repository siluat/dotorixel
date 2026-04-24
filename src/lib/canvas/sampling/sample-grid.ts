import type { CanvasCoords } from '../canvas-model';
import type { Color } from '../color';
import type { CanvasSamplingPort } from './ports';

/**
 * Returns a row-major flat array of length `size × size` for an N×N pixel
 * grid centered on `center`. Cells whose canvas coordinates fall outside
 * `[0, width) × [0, height)` are returned as `null`, distinguishing
 * "no pixel here" from transparent pixels (which return RGBA with `a = 0`).
 *
 * `size` is expected to be an odd positive integer; the center cell is at
 * index `(size² - 1) / 2` in the returned array.
 */
export function sampleGrid(
	canvas: CanvasSamplingPort,
	center: CanvasCoords,
	size: number
): (Color | null)[] {
	const result: (Color | null)[] = [];
	const half = Math.floor(size / 2);
	for (let dy = -half; dy <= half; dy++) {
		for (let dx = -half; dx <= half; dx++) {
			const cx = center.x + dx;
			const cy = center.y + dy;
			if (cx < 0 || cy < 0 || cx >= canvas.width || cy >= canvas.height) {
				result.push(null);
				continue;
			}
			const p = canvas.get_pixel(cx, cy);
			result.push({ r: p.r, g: p.g, b: p.b, a: p.a });
		}
	}
	return result;
}
