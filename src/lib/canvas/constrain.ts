import type { CanvasCoords } from './view-types';

/** Snaps `end` to the nearest 45° multiple direction from `start` (8-directional). */
export function constrainLine(start: CanvasCoords, end: CanvasCoords): CanvasCoords {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const absDx = Math.abs(dx);
	const absDy = Math.abs(dy);

	// Horizontal: angle close to 0° or 180°
	if (absDy * 2 <= absDx) {
		return { x: end.x, y: start.y };
	}

	// Vertical: angle close to 90° or 270°
	if (absDx * 2 <= absDy) {
		return { x: start.x, y: end.y };
	}

	// 45° diagonal: force |dx| = |dy| = max(|dx|, |dy|)
	const dist = Math.max(absDx, absDy);
	return {
		x: start.x + dist * Math.sign(dx),
		y: start.y + dist * Math.sign(dy)
	};
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
