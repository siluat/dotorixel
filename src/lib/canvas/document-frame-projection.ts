import type { Document } from './canvas-model';

/**
 * One frame projected into a shell-facing read model. A Frame is identity-only,
 * so this carries its `id` plus the set of Pixel Layer ids whose Cel at this
 * frame is content-bearing — the timeline grid renders a dot for each.
 */
export interface DocumentFrameRead {
	readonly id: string;
	readonly occupiedLayerIds: ReadonlySet<string>;
}

export interface DocumentFrameProjectionRead {
	/** Frames in axis order; the 1-based ordinal a panel shows is `index + 1`. */
	readonly frames: readonly DocumentFrameRead[];
	readonly activeFrameId: string;
}

/**
 * Projects a Document's Frame axis into a shell-facing read model — frames in
 * axis order, the active frame, and per-Cel occupancy for the timeline grid.
 * Stateless and orthogonal to {@link DocumentLayerProjection}: this owns the
 * temporal axis, leaving the Layer stack (and its source cache) to the layer
 * projection.
 */
export function readDocumentFrameProjection(document: Document): DocumentFrameProjectionRead {
	const frameIds = document.frames_metadata().map((frame) => frame.id);
	const records = document.layers_metadata();
	const occupiedByFrame = new Map<string, Set<string>>(
		frameIds.map((id) => [id, new Set<string>()])
	);

	for (let stackIndex = 0; stackIndex < records.length; stackIndex++) {
		if (records[stackIndex].kind !== 'pixel') continue;
		const layerId = records[stackIndex].id;
		for (const frameId of frameIds) {
			// Seam: occupancy is inferred from the cel buffer today. A core
			// `cel_is_empty` (returning a bool, no buffer copy) could replace this
			// single read later without touching the panel or the page wiring.
			const pixels = document.cel_pixels_at(stackIndex, frameId);
			if (pixels && hasContent(pixels)) {
				occupiedByFrame.get(frameId)!.add(layerId);
			}
		}
	}

	return {
		frames: frameIds.map((id) => ({ id, occupiedLayerIds: occupiedByFrame.get(id)! })),
		activeFrameId: document.active_frame_id()
	};
}

/** A Cel is content-bearing when any pixel has a non-zero alpha channel. */
function hasContent(pixels: Uint8Array): boolean {
	for (let i = 3; i < pixels.length; i += 4) {
		if (pixels[i] !== 0) return true;
	}
	return false;
}
