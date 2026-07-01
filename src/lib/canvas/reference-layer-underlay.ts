import type { CanvasCoords, CanvasPoint, ReferencePlacement } from './canvas-model';
import { effectivePixelSize, type ViewportData } from './viewport';

/**
 * Shell-facing projection of a visible Reference Layer. It carries the source
 * payload and geometry needed by rendering, placement UI, and source sampling.
 */
export interface ReferenceLayerUnderlay {
	/** Stable identity for the source pixels; must change when the source image changes. */
	readonly sourceKey: string;
	/** Tightly packed row-major RGBA bytes; length must equal `naturalWidth * naturalHeight * 4`. */
	readonly sourceRgba: Uint8Array;
	/** Positive intrinsic source-image width in pixels. */
	readonly naturalWidth: number;
	/** Positive intrinsic source-image height in pixels. */
	readonly naturalHeight: number;
	/** Source-to-document placement in canvas pixel coordinates. */
	readonly placement: ReferencePlacement;
	/**
	 * Projected axis-aligned bounding box in canvas-pixel coordinates, sourced
	 * once from the core (`reference_layer_footprint_at`) at projection-build
	 * time. The single producer of the rotation-aware footprint: the render rect
	 * and Navigation Bounds both read this instead of recomputing the swap.
	 */
	readonly projectedBounds: ReferenceLayerUnderlayBounds;
	/** Normalized underlay opacity in `[0, 1]`, applied when drawing the source raster. */
	readonly opacity: number;
}

export interface ReferenceLayerUnderlayRect {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
}

export interface ReferenceLayerUnderlayBounds {
	readonly minX: number;
	readonly minY: number;
	readonly maxX: number;
	readonly maxY: number;
}

/**
 * Normalizes an optional quarter-turn into `0 | 1 | 2 | 3` (absence → 0). The
 * input is truncated to an integer first, so a corrupt fractional value can't
 * leak through the `% 4` and violate the return-type contract.
 */
export function normalizedQuarterTurn(rotation: number | undefined): 0 | 1 | 2 | 3 {
	const turns = Number.isFinite(rotation) ? Math.trunc(rotation as number) : 0;
	return ((((turns % 4) + 4) % 4) as 0 | 1 | 2 | 3);
}

export function referenceLayerUnderlaySourceCoords(
	underlay: ReferenceLayerUnderlay,
	coords: CanvasPoint
): CanvasCoords {
	const { x, y, scale } = underlay.placement;
	// The rendered footprint is the source turned `rotation` quarter-turns, so
	// these grid coordinates index the rotated footprint, not the source yet.
	const gridX = Math.floor((coords.x - x) / scale);
	const gridY = Math.floor((coords.y - y) / scale);
	const lastX = underlay.naturalWidth - 1;
	const lastY = underlay.naturalHeight - 1;
	// Invert the clockwise quarter-turn on the integer pixel grid.
	switch (normalizedQuarterTurn(underlay.placement.rotation)) {
		case 1:
			return { x: gridY, y: lastY - gridX };
		case 2:
			return { x: lastX - gridX, y: lastY - gridY };
		case 3:
			return { x: lastX - gridY, y: gridX };
		default:
			return { x: gridX, y: gridY };
	}
}

export function referenceLayerUnderlayDocumentRect(
	underlay: ReferenceLayerUnderlay,
	viewport: ViewportData
): ReferenceLayerUnderlayRect {
	const scaledPixel = effectivePixelSize(viewport);
	const { minX, minY, maxX, maxY } = underlay.projectedBounds;
	return {
		left: minX * scaledPixel,
		top: minY * scaledPixel,
		width: (maxX - minX) * scaledPixel,
		height: (maxY - minY) * scaledPixel
	};
}

export function referenceLayerUnderlayViewportRect(
	underlay: ReferenceLayerUnderlay,
	viewport: ViewportData
): ReferenceLayerUnderlayRect {
	const rect = referenceLayerUnderlayDocumentRect(underlay, viewport);
	return {
		left: Math.round(viewport.panX) + rect.left,
		top: Math.round(viewport.panY) + rect.top,
		width: rect.width,
		height: rect.height
	};
}
