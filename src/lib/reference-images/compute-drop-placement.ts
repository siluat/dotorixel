import type { Placement } from './compute-initial-placement';
import { computeWindowSize } from './compute-window-size';

export type ComputeDropPlacementInput = {
	naturalWidth: number;
	naturalHeight: number;
	viewportWidth: number;
	viewportHeight: number;
	dropX: number;
	dropY: number;
};

/**
 * Compute placement for a reference window dropped at a specific viewport point.
 *
 * Sizing matches {@link computeInitialPlacement} via the shared `computeWindowSize`.
 * Position centers the window on the drop point and clamps so the window stays
 * fully inside the viewport.
 */
export function computeDropPlacement(input: ComputeDropPlacementInput): Placement {
	const { naturalWidth, naturalHeight, viewportWidth, viewportHeight, dropX, dropY } = input;
	const { width, height } = computeWindowSize({
		naturalWidth,
		naturalHeight,
		viewportWidth,
		viewportHeight
	});

	const rawX = dropX - width / 2;
	const rawY = dropY - height / 2;
	const x = clamp(rawX, 0, Math.max(0, viewportWidth - width));
	const y = clamp(rawY, 0, Math.max(0, viewportHeight - height));
	return { x, y, width, height };
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
