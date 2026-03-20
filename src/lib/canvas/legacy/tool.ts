import { TRANSPARENT, type Color } from '../color.ts';
import { isInsideBounds, setPixel, type PixelCanvas, type CanvasCoords } from './canvas.ts';

export type ToolType = 'pencil' | 'eraser';

export function interpolatePixels(
	x0: number,
	y0: number,
	x1: number,
	y1: number
): CanvasCoords[] {
	const points: CanvasCoords[] = [];
	let dx = Math.abs(x1 - x0);
	let dy = -Math.abs(y1 - y0);
	const sx = x0 < x1 ? 1 : -1;
	const sy = y0 < y1 ? 1 : -1;
	let err = dx + dy;
	let x = x0;
	let y = y0;

	for (;;) {
		points.push({ x, y });
		if (x === x1 && y === y1) break;
		const e2 = 2 * err;
		if (e2 >= dy) {
			err += dy;
			x += sx;
		}
		if (e2 <= dx) {
			err += dx;
			y += sy;
		}
	}

	return points;
}

export function applyTool(
	canvas: PixelCanvas,
	x: number,
	y: number,
	tool: ToolType,
	foregroundColor: Color
): boolean {
	if (!isInsideBounds(canvas, x, y)) return false;
	setPixel(canvas, x, y, tool === 'pencil' ? foregroundColor : TRANSPARENT);
	return true;
}
