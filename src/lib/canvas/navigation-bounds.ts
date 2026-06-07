/**
 * Document-space rectangle, in canvas-pixel coordinates, used both as the
 * computed Navigation Bounds and as the Reference footprint fed into it.
 */
export interface NavigationBounds {
	readonly minX: number;
	readonly minY: number;
	readonly maxX: number;
	readonly maxY: number;
}

export interface CanvasDimensions {
	readonly width: number;
	readonly height: number;
}

/**
 * The document-space region a tab's viewport pan is clamped to: the union of
 * the canvas rectangle and, when supplied, an active Reference Layer's visible
 * underlay footprint. The footprint enters as an input so its source can change
 * (reference-geometry consolidation) without touching this computation.
 *
 * Returns the canvas rectangle alone when no footprint is given or when the
 * footprint lies entirely within the canvas.
 */
export function navigationBounds(
	canvas: CanvasDimensions,
	referenceFootprint: NavigationBounds | null
): NavigationBounds {
	const canvasBounds: NavigationBounds = {
		minX: 0,
		minY: 0,
		maxX: canvas.width,
		maxY: canvas.height
	};
	if (!referenceFootprint) return canvasBounds;
	return {
		minX: Math.min(canvasBounds.minX, referenceFootprint.minX),
		minY: Math.min(canvasBounds.minY, referenceFootprint.minY),
		maxX: Math.max(canvasBounds.maxX, referenceFootprint.maxX),
		maxY: Math.max(canvasBounds.maxY, referenceFootprint.maxY)
	};
}
