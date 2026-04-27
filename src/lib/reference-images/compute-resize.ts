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
 * - When the result would fall below `minSize` on either axis, the size is
 *   scaled back up so the smaller axis lands exactly at `minSize` and the
 *   other axis follows from the aspect. Both axes always satisfy `>= minSize`.
 *
 * Pure: no side effects. All inputs are assumed positive.
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

	if (width < minSize || height < minSize) {
		const scaleUp = Math.max(minSize / width, minSize / height);
		width *= scaleUp;
		height *= scaleUp;
	}
	return { width, height };
}
