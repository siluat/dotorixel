import { MIN_WINDOW_EDGE } from './reference-window-constants';

export type ComputeWindowSizeInput = {
	naturalWidth: number;
	naturalHeight: number;
	viewportWidth: number;
	viewportHeight: number;
};

export type WindowSize = {
	width: number;
	height: number;
};

const VIEWPORT_FRACTION = 0.3;

/**
 * Aspect-preserving window size for a reference image.
 *
 * - Longer edge ≤ `max(viewportWidth, viewportHeight) * 0.3`.
 * - Shorter edge scaled up to ≥ {@link MIN_WINDOW_EDGE} when the natural shape is very thin.
 * - Final size capped to the viewport — overrides the floor when it would push the
 *   window past the viewport (extreme aspect ratios on small viewports).
 */
export function computeWindowSize(input: ComputeWindowSizeInput): WindowSize {
	const { naturalWidth, naturalHeight, viewportWidth, viewportHeight } = input;
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

	return { width: naturalWidth * scale, height: naturalHeight * scale };
}
