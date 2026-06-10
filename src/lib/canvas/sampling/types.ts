import type { Color } from '../color';

/**
 * Picks between the mouse and touch loupe positioning offsets.
 * Owned by the sampling module so that loupe-position math, the session,
 * and the visualization (Loupe.svelte) all reference a single source.
 */
export type LoupeInputSource = 'mouse' | 'touch';

export interface SamplingSessionUpdatePointerParams {
	readonly screen: { readonly x: number; readonly y: number };
	readonly viewport: { readonly width: number; readonly height: number };
}

export interface SamplingSessionView {
	readonly grid: readonly (Color | null)[];
	/** Window-coord top-left of the loupe overlay; null when inactive or before any pointer push. */
	readonly position: { readonly x: number; readonly y: number } | null;
	/** Always safe to call — pointer state caches even when the session is inactive. */
	updatePointer(params: SamplingSessionUpdatePointerParams): void;
}
