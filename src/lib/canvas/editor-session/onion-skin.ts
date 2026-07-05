/**
 * How many neighbors the Onion Skin projects on each side of the Active
 * Frame. Counts flow as data so a future range control adds only UI; v1
 * ships the fixed {@link DEFAULT_ONION_SKIN_CONFIG}.
 */
export interface OnionSkinConfig {
	readonly previousCount: number;
	readonly nextCount: number;
}

/** The v1 fixed range: one ghost on each side of the Active Frame. */
export const DEFAULT_ONION_SKIN_CONFIG: OnionSkinConfig = {
	previousCount: 1,
	nextCount: 1
};

export type OnionSkinGhostKind = 'previous' | 'next';

/**
 * One ghost the Onion Skin should show: which frame, on which side of the
 * Active Frame, and how far along the axis (`distance` 1 is the immediate
 * neighbor).
 */
export interface OnionSkinGhostDescriptor {
	readonly frameId: string;
	readonly kind: OnionSkinGhostKind;
	readonly distance: number;
}

/**
 * One ghost projected for rendering — its descriptor plus the neighbor
 * frame's committed composite (`composite_at`) pixels, with layer visibility
 * and opacity applied and the Reference Layer excluded.
 */
export interface OnionSkinGhostRead {
	readonly frameId: string;
	readonly kind: OnionSkinGhostKind;
	readonly distance: number;
	readonly pixels: Uint8Array;
}

/**
 * Pure neighbor selection for the Onion Skin — the only new seam in PRD 217.
 * Given the frame ids in axis order, the Active Frame's id, and the range
 * config, it returns the ghost descriptors in axis order (previous ghosts
 * farthest first, then next ghosts nearest first). Sides clamp at the axis
 * ends and never wrap around, so a ghost always means an adjacent position
 * on the axis. `activeFrameId` must be present in `frameIds` — the Document
 * guarantees the Active Frame is always on the axis, and callers read both
 * from the same frame projection.
 */
export function onionSkinGhosts(
	frameIds: readonly string[],
	activeFrameId: string,
	config: OnionSkinConfig
): OnionSkinGhostDescriptor[] {
	const activeIndex = frameIds.indexOf(activeFrameId);
	const ghosts: OnionSkinGhostDescriptor[] = [];
	for (let distance = config.previousCount; distance >= 1; distance--) {
		const index = activeIndex - distance;
		if (index >= 0) {
			ghosts.push({ frameId: frameIds[index], kind: 'previous', distance });
		}
	}
	for (let distance = 1; distance <= config.nextCount; distance++) {
		const index = activeIndex + distance;
		if (index < frameIds.length) {
			ghosts.push({ frameId: frameIds[index], kind: 'next', distance });
		}
	}
	return ghosts;
}
