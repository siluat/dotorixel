import type { CanvasCoords, CanvasPoint, Document, ReferencePlacement } from './canvas-model';
import type { ViewportData } from './viewport';

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

interface CachedReferenceLayerSource {
	readonly document: Document;
	readonly layerId: string;
	readonly sourceFingerprint: string;
	readonly naturalWidth: number;
	readonly naturalHeight: number;
	readonly sourceKey: string;
	readonly sourceRgba: Uint8Array;
}

/**
 * Per-tab Reference Layer Underlay projector. The projector owns the
 * WASM-copy cache for source RGBA bytes while the renderer keeps its own
 * raster cache behind the canvas drawing seam.
 */
export class ReferenceLayerUnderlayProjector {
	#source?: CachedReferenceLayerSource;

	#clear(): undefined {
		this.#source = undefined;
		return undefined;
	}

	project(document: Document): ReferenceLayerUnderlay | undefined {
		for (let i = 0; i < document.layer_count(); i++) {
			if (document.layer_kind_at(i) !== 'reference') continue;
			if (!document.layer_visible_at(i)) return this.#clear();

			const layerId = document.layer_id_at(i);
			const sourceFingerprint = document.layer_source_fingerprint_at(i);
			const dimensions = document.layer_source_dimensions_at(i);
			const placement = document.layer_placement_at(i);
			const opacity = document.layer_opacity_at(i);
			if (!layerId || !sourceFingerprint || !dimensions || !placement || opacity === undefined) {
				return this.#clear();
			}

			const naturalWidth = dimensions[0];
			const naturalHeight = dimensions[1];
			let source =
				this.#source?.document === document &&
				this.#source.layerId === layerId &&
				this.#source.sourceFingerprint === sourceFingerprint &&
				this.#source.naturalWidth === naturalWidth &&
				this.#source.naturalHeight === naturalHeight
					? this.#source
					: undefined;

			if (!source) {
				const sourceRgba = document.layer_source_pixels_at(i);
				if (!sourceRgba) return this.#clear();
				source = {
					document,
					layerId,
					sourceFingerprint,
					naturalWidth,
					naturalHeight,
					sourceKey: `${layerId}:${naturalWidth}x${naturalHeight}:${sourceFingerprint}`,
					sourceRgba
				};
				this.#source = source;
			}

			return {
				sourceKey: source.sourceKey,
				sourceRgba: source.sourceRgba,
				naturalWidth,
				naturalHeight,
				placement: {
					x: placement.x,
					y: placement.y,
					scale: placement.scale
				},
				opacity
			};
		}
		return this.#clear();
	}
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
	const scaledPixel = Math.round(viewport.pixelSize * viewport.zoom);
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
