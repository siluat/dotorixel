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

export function referenceLayerUnderlaySourceCoords(
	underlay: ReferenceLayerUnderlay,
	coords: CanvasPoint
): CanvasCoords {
	const { x, y, scale } = underlay.placement;
	return {
		x: Math.floor((coords.x - x) / scale),
		y: Math.floor((coords.y - y) / scale)
	};
}

export function referenceLayerUnderlayDocumentRect(
	underlay: ReferenceLayerUnderlay,
	viewport: ViewportData
): ReferenceLayerUnderlayRect {
	const scaledPixel = effectivePixelSize(viewport);
	const { x, y, scale } = underlay.placement;
	return {
		left: x * scaledPixel,
		top: y * scaledPixel,
		width: underlay.naturalWidth * scale * scaledPixel,
		height: underlay.naturalHeight * scale * scaledPixel
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

export function referenceLayerUnderlayBounds(
	underlay: ReferenceLayerUnderlay
): ReferenceLayerUnderlayBounds {
	const { x, y, scale } = underlay.placement;
	return {
		minX: x,
		minY: y,
		maxX: x + underlay.naturalWidth * scale,
		maxY: y + underlay.naturalHeight * scale
	};
}
