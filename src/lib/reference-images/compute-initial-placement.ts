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

const MIN_EDGE = 80;
const VIEWPORT_FRACTION = 0.3;
const CASCADE_OFFSET = 24;

export function computeInitialPlacement(input: ComputeInitialPlacementInput): Placement {
	const { naturalWidth, naturalHeight, viewportWidth, viewportHeight, cascadeIndex } = input;
	const naturalLonger = Math.max(naturalWidth, naturalHeight);
	const naturalShorter = Math.min(naturalWidth, naturalHeight);
	const viewportLonger = Math.max(viewportWidth, viewportHeight);

	let scale = Math.min(naturalLonger, viewportLonger * VIEWPORT_FRACTION) / naturalLonger;
	if (naturalShorter * scale < MIN_EDGE) {
		scale = MIN_EDGE / naturalShorter;
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
