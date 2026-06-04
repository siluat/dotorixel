import type { CanvasCoords } from './canvas-model';

/** Snaps `end` to the nearest 45-degree multiple direction from `start` (8-directional). */
export function constrainLine(start: CanvasCoords, end: CanvasCoords): CanvasCoords {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const absDx = Math.abs(dx);
	const absDy = Math.abs(dy);

	if (absDy * 2 <= absDx) {
		return { x: end.x, y: start.y };
	}

	if (absDx * 2 <= absDy) {
		return { x: start.x, y: end.y };
	}

	const dist = Math.max(absDx, absDy);
	return {
		x: start.x + dist * Math.sign(dx),
		y: start.y + dist * Math.sign(dy)
	};
}

/** Locks `end` to the horizontal or vertical axis with the larger movement from `start`. */
export function constrainAxis(start: CanvasCoords, end: CanvasCoords): CanvasCoords {
	const dx = end.x - start.x;
	const dy = end.y - start.y;

	return Math.abs(dx) >= Math.abs(dy) ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
}

/** Forces the bounding box defined by `start` and `end` into a square. */
export function constrainSquare(start: CanvasCoords, end: CanvasCoords): CanvasCoords {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const side = Math.max(Math.abs(dx), Math.abs(dy));

	return {
		x: start.x + side * (dx >= 0 ? 1 : -1),
		y: start.y + side * (dy >= 0 ? 1 : -1)
	};
}
