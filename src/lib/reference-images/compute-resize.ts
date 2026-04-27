export type ComputeResizeInput = {
	startWidth: number;
	startHeight: number;
	deltaX: number;
	deltaY: number;
	minSize: number;
};

export type Size = {
	width: number;
	height: number;
};

/**
 * Compute the next size for an aspect-locked corner-handle resize.
 *
 * - Aspect ratio is taken from the starting size and preserved in the result.
 * - The dominant axis (the one whose pointer delta represents the larger
 *   relative change) drives the size; the other axis follows from the aspect.
 *   This makes diagonal drags feel predictable regardless of which axis the
 *   user emphasises.
 * - The result is clamped to an aspect-preserving floor: the shorter axis
 *   lands at `minSize` and the other axis follows from the aspect. Both axes
 *   always satisfy `>= minSize`, including when proposed dims become zero or
 *   negative (reachable when the pointer drags past the window's top-left
 *   corner — pointer capture lets the cursor go anywhere on screen).
 *
 * Pure: no side effects. `startWidth`, `startHeight`, and `minSize` are
 * assumed positive; `deltaX` / `deltaY` are signed (negative when shrinking).
 */
export function computeResize(input: ComputeResizeInput): Size {
	const { startWidth, startHeight, deltaX, deltaY, minSize } = input;
	const aspect = startWidth / startHeight;
	const proposedWidth = startWidth + deltaX;
	const proposedHeight = startHeight + deltaY;
	const widthRatio = proposedWidth / startWidth;
	const heightRatio = proposedHeight / startHeight;

	let width: number;
	let height: number;
	if (widthRatio >= heightRatio) {
		width = proposedWidth;
		height = proposedWidth / aspect;
	} else {
		width = proposedHeight * aspect;
		height = proposedHeight;
	}

	const minWidth = aspect >= 1 ? minSize * aspect : minSize;
	const minHeight = aspect >= 1 ? minSize : minSize / aspect;
	width = Math.max(width, minWidth);
	height = Math.max(height, minHeight);
	return { width, height };
}
