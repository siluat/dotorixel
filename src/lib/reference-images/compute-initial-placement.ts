import { computeWindowSize } from './compute-window-size';
import { CASCADE_OFFSET } from './reference-window-constants';

export type ComputeInitialPlacementInput = {
	naturalWidth: number;
	naturalHeight: number;
	viewportWidth: number;
	viewportHeight: number;
	cascadeIndex: number;
};

export type Placement = {
	x: number;
	y: number;
	width: number;
	height: number;
};

/**
 * Compute initial placement for a newly-displayed reference window.
 *
 * Sizing matches {@link computeWindowSize}.
 *
 * Positioning:
 * - Centered in the viewport, then shifted by `cascadeIndex × 24` on both axes.
 * - Clamped so the window stays fully inside the viewport.
 *
 * Pure: no side effects. All inputs are assumed positive.
 */
export function computeInitialPlacement(input: ComputeInitialPlacementInput): Placement {
	const { naturalWidth, naturalHeight, viewportWidth, viewportHeight, cascadeIndex } = input;
	const { width, height } = computeWindowSize({
		naturalWidth,
		naturalHeight,
		viewportWidth,
		viewportHeight
	});

	const offset = cascadeIndex * CASCADE_OFFSET;
	const rawX = (viewportWidth - width) / 2 + offset;
	const rawY = (viewportHeight - height) / 2 + offset;
	const x = clamp(rawX, 0, Math.max(0, viewportWidth - width));
	const y = clamp(rawY, 0, Math.max(0, viewportHeight - height));
	return { x, y, width, height };
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
