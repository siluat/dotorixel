import type { LoupeInputSource } from './types';

/** Which quadrant of the pointer the loupe occupies. */
export type Quadrant = 'tl' | 'tr' | 'bl' | 'br';

export interface LoupePositionInput {
	/** Pointer position in viewport coordinates. */
	readonly pointer: { readonly x: number; readonly y: number };
	/** Visible viewport dimensions in pixels. */
	readonly viewport: { readonly width: number; readonly height: number };
	/** Rendered loupe dimensions in pixels. */
	readonly loupe: { readonly width: number; readonly height: number };
	/** Pointer-to-loupe gap in pixels for mouse input (applied symmetrically on x and y). */
	readonly mouseOffset: number;
	/** Pointer-to-loupe vertical gap in pixels for touch input (touch is centered horizontally). */
	readonly touchOffset: number;
	readonly inputSource: LoupeInputSource;
}

export interface LoupePosition {
	/** Top-left of the loupe in viewport coordinates. */
	readonly x: number;
	readonly y: number;
	/** The quadrant the loupe ended up in relative to the pointer. */
	readonly quadrant: Quadrant;
}

/**
 * Computes the loupe's screen position so it stays inside the viewport.
 * Default quadrant is `tr` (top-right of the pointer); the loupe flips to
 * the opposite vertical and/or horizontal half when the default would clip.
 *
 * Touch input centers the loupe horizontally on the pointer. Touch never
 * flips horizontally; if the centered position would clip a viewport side,
 * the loupe is clamped inward.
 */
export function computeLoupePosition(input: LoupePositionInput): LoupePosition {
	if (input.inputSource === 'mouse') return mousePosition(input);
	return touchPosition(input);
}

function mousePosition(input: LoupePositionInput): LoupePosition {
	const { pointer, viewport, loupe, mouseOffset } = input;

	const defaultX = pointer.x + mouseOffset;
	const flipsHorizontal = defaultX + loupe.width > viewport.width;
	const x = flipsHorizontal ? pointer.x - loupe.width - mouseOffset : defaultX;

	const defaultY = pointer.y - loupe.height - mouseOffset;
	const flipsVertical = defaultY < 0;
	const y = flipsVertical ? pointer.y + mouseOffset : defaultY;

	const quadrant: Quadrant = flipsVertical
		? flipsHorizontal
			? 'bl'
			: 'br'
		: flipsHorizontal
			? 'tl'
			: 'tr';

	// Degenerate-viewport safety net: in viewports too narrow or too short
	// for even the flipped position to fit, clamp inward so at least one edge
	// stays on-screen. Mirrors the touch branch's clamping pattern.
	return {
		x: Math.max(0, Math.min(x, viewport.width - loupe.width)),
		y: Math.max(0, Math.min(y, viewport.height - loupe.height)),
		quadrant
	};
}

function touchPosition(input: LoupePositionInput): LoupePosition {
	const { pointer, viewport, loupe, touchOffset } = input;

	// Touch always centers horizontally per the design spec; if centering
	// would push the loupe off either side, we clamp inward (no horizontal
	// flip) so the visual relationship "loupe sits above/below the finger"
	// is preserved.
	const centeredX = pointer.x - loupe.width / 2;
	const x = Math.max(0, Math.min(centeredX, viewport.width - loupe.width));

	const defaultY = pointer.y - loupe.height - touchOffset;
	const flipsVertical = defaultY < 0;
	const y = flipsVertical ? pointer.y + touchOffset : defaultY;

	// On mobile-portrait heights (~600–700px usable), a narrow band of
	// pointer.y values flips the loupe yet still clips the bottom edge.
	// Clamp y inward as a safety net, mirroring the mouse branch.
	return {
		x,
		y: Math.max(0, Math.min(y, viewport.height - loupe.height)),
		quadrant: flipsVertical ? 'br' : 'tr'
	};
}
