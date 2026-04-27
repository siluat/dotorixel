import { MIN_WINDOW_EDGE } from './reference-window-constants';

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

const VIEWPORT_FRACTION = 0.3;
const CASCADE_OFFSET = 24;

/**
 * Compute initial placement for a newly-displayed reference window.
 *
 * Sizing (aspect-preserving):
 * - Longer edge ≤ `max(viewportWidth, viewportHeight) * 0.3`.
 * - Shorter edge scaled up to ≥ 80px when the natural shape is very thin.
 * - Final size capped to the viewport — overrides the 80px floor when the
 *   floor would push the window past the viewport (e.g. extreme aspect ratios
 *   on small viewports), keeping the window fully visible.
 *
 * Positioning:
 * - Centered in the viewport, then shifted by `cascadeIndex × 24` on both axes.
 * - Clamped so the window stays fully inside the viewport.
 *
 * Pure: no side effects. All inputs are assumed positive.
 */
export function computeInitialPlacement(input: ComputeInitialPlacementInput): Placement {
	const { naturalWidth, naturalHeight, viewportWidth, viewportHeight, cascadeIndex } = input;
	const naturalLonger = Math.max(naturalWidth, naturalHeight);
	const naturalShorter = Math.min(naturalWidth, naturalHeight);
	const viewportLonger = Math.max(viewportWidth, viewportHeight);

	let scale = Math.min(naturalLonger, viewportLonger * VIEWPORT_FRACTION) / naturalLonger;
	if (naturalShorter * scale < MIN_WINDOW_EDGE) {
		scale = MIN_WINDOW_EDGE / naturalShorter;
	}
	const scaleViewportMax = Math.min(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
	if (scale > scaleViewportMax) {
		scale = scaleViewportMax;
	}

	const width = naturalWidth * scale;
	const height = naturalHeight * scale;
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
