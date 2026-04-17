import type { PixelCanvas, CanvasCoords } from './canvas-model';
import type { Color } from './color';

/**
 * Returns a row-major flat array of RGBA values for an N×N pixel grid
 * centered on `center`. The grid reads the canvas via `get_pixel`, clamping
 * coordinates to the canvas bounds so the returned array always has length
 * `size × size` even when `center` is near or outside a canvas edge.
 *
 * `size` is expected to be an odd positive integer; the center cell is at
 * index `(size² - 1) / 2` in the returned array.
 */
export function sampleGrid(canvas: PixelCanvas, center: CanvasCoords, size: number): Color[] {
	const result: Color[] = [];
	const half = Math.floor(size / 2);
	for (let dy = -half; dy <= half; dy++) {
		for (let dx = -half; dx <= half; dx++) {
			const cx = Math.max(0, Math.min(canvas.width - 1, center.x + dx));
			const cy = Math.max(0, Math.min(canvas.height - 1, center.y + dy));
			const p = canvas.get_pixel(cx, cy);
			result.push({ r: p.r, g: p.g, b: p.b, a: p.a });
		}
	}
	return result;
}
