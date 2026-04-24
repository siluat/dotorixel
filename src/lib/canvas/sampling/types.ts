/**
 * Picks between the mouse and touch loupe positioning offsets.
 * Owned by the sampling module so that loupe-position math, the session,
 * and the visualization (Loupe.svelte) all reference a single source.
 */
export type LoupeInputSource = 'mouse' | 'touch';
