import { CASCADE_OFFSET, MIN_WINDOW_EDGE } from './reference-window-constants';

export type Placement = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type Viewport = {
	width: number;
	height: number;
};

export type ImageSize = {
	width: number;
	height: number;
};

export type PlacementIntent =
	| { kind: 'centered'; cascadeIndex: number }
	| { kind: 'at-point'; x: number; y: number };

const VIEWPORT_FRACTION = 0.3;

/**
 * Build a fresh {@link Placement} for a newly-displayed reference window.
 *
 * Sizing is aspect-preserving: the longer edge sits at
 * `max(viewport.width, viewport.height) × 0.3`, the shorter edge is lifted to
 * at least {@link MIN_WINDOW_EDGE}, and the result is capped to the viewport
 * for extreme aspects on small viewports.
 *
 * Position depends on the {@link PlacementIntent}:
 * - `centered` — viewport-centered, then offset by `cascadeIndex × CASCADE_OFFSET`.
 * - `at-point` — centered on the supplied `(x, y)`.
 *
 * The result is always clamped so the window stays fully inside the viewport.
 */
export function createPlacement(
	image: ImageSize,
	intent: PlacementIntent,
	viewport: Viewport
): Placement {
	const { width, height } = aspectFitSize(image, viewport);
	const { x, y } = anchorFor(intent, width, height, viewport);
	return clampInsideViewport(x, y, width, height, viewport);
}

/**
 * Re-fit an existing {@link Placement} to a (typically smaller) viewport.
 *
 * Idempotent when the placement already fits. When the viewport is smaller,
 * the window is shrunk by a single uniform scale (preserving aspect) and its
 * position is re-clamped inside the new viewport.
 */
export function refitPlacement(current: Placement, viewport: Viewport): Placement {
	const shrink = Math.min(1, viewport.width / current.width, viewport.height / current.height);
	const width = current.width * shrink;
	const height = current.height * shrink;
	return clampInsideViewport(current.x, current.y, width, height, viewport);
}

/**
 * Commit a drag-released position. Size is unchanged; `(x, y)` is clamped so
 * the window stays fully inside the viewport.
 */
export function commitMove(
	current: Placement,
	x: number,
	y: number,
	viewport: Viewport
): Placement {
	return clampInsideViewport(x, y, current.width, current.height, viewport);
}

/**
 * Commit a corner-handle resize. Aspect ratio is locked to `current`'s; the
 * dominant axis (the one whose pointer delta drives the larger relative
 * change) drives the resulting size. The shorter edge floors at
 * {@link MIN_WINDOW_EDGE}, and the result is capped against the available
 * space from the anchored top-left so the window stays inside the viewport
 * (preserving aspect). `(x, y)` is unchanged — the top-left stays anchored.
 */
export function commitResize(
	current: Placement,
	deltaW: number,
	deltaH: number,
	viewport: Viewport
): Placement {
	const aspect = current.width / current.height;
	const proposedWidth = current.width + deltaW;
	const proposedHeight = current.height + deltaH;
	const widthRatio = proposedWidth / current.width;
	const heightRatio = proposedHeight / current.height;

	let width: number;
	let height: number;
	if (widthRatio >= heightRatio) {
		width = proposedWidth;
		height = proposedWidth / aspect;
	} else {
		width = proposedHeight * aspect;
		height = proposedHeight;
	}

	const minWidth = aspect >= 1 ? MIN_WINDOW_EDGE * aspect : MIN_WINDOW_EDGE;
	const minHeight = aspect >= 1 ? MIN_WINDOW_EDGE : MIN_WINDOW_EDGE / aspect;
	width = Math.max(width, minWidth);
	height = Math.max(height, minHeight);

	const availableWidth = Math.max(0, viewport.width - current.x);
	const availableHeight = Math.max(0, viewport.height - current.y);
	const viewportShrink = Math.min(1, availableWidth / width, availableHeight / height);
	width *= viewportShrink;
	height *= viewportShrink;

	return { x: current.x, y: current.y, width, height };
}

function aspectFitSize(image: ImageSize, viewport: Viewport): ImageSize {
	const longer = Math.max(image.width, image.height);
	const shorter = Math.min(image.width, image.height);
	const viewportLonger = Math.max(viewport.width, viewport.height);

	let scale = Math.min(longer, viewportLonger * VIEWPORT_FRACTION) / longer;
	if (shorter * scale < MIN_WINDOW_EDGE) {
		scale = MIN_WINDOW_EDGE / shorter;
	}
	const viewportMaxScale = Math.min(viewport.width / image.width, viewport.height / image.height);
	if (scale > viewportMaxScale) {
		scale = viewportMaxScale;
	}
	return { width: image.width * scale, height: image.height * scale };
}

function anchorFor(
	intent: PlacementIntent,
	width: number,
	height: number,
	viewport: Viewport
): { x: number; y: number } {
	if (intent.kind === 'at-point') {
		return { x: intent.x - width / 2, y: intent.y - height / 2 };
	}
	const offset = intent.cascadeIndex * CASCADE_OFFSET;
	return {
		x: (viewport.width - width) / 2 + offset,
		y: (viewport.height - height) / 2 + offset
	};
}

function clampInsideViewport(
	x: number,
	y: number,
	width: number,
	height: number,
	viewport: Viewport
): Placement {
	const maxX = Math.max(0, viewport.width - width);
	const maxY = Math.max(0, viewport.height - height);
	return {
		x: clamp(x, 0, maxX),
		y: clamp(y, 0, maxY),
		width,
		height
	};
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
