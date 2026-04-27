export type ClampPositionInput = {
	x: number;
	y: number;
	width: number;
	height: number;
	viewportWidth: number;
	viewportHeight: number;
};

export type Position = {
	x: number;
	y: number;
};

/**
 * Clamp a window's position so the entire window stays inside the viewport.
 *
 * Used on drag/resize release to commit a "safe" position to the store —
 * matches the render-time fit policy in `ReferenceWindowOverlay`, so the
 * stored intent and the rendered position agree and the title bar stays
 * grabbable.
 *
 * If the window is larger than the viewport on either axis, that axis snaps
 * to `0` (top/left) — preferring origin over off-screen.
 *
 * Pure: no side effects. All inputs are assumed non-negative.
 */
export function clampPosition(input: ClampPositionInput): Position {
	const { x, y, width, height, viewportWidth, viewportHeight } = input;
	const maxX = Math.max(0, viewportWidth - width);
	const maxY = Math.max(0, viewportHeight - height);
	return {
		x: clamp(x, 0, maxX),
		y: clamp(y, 0, maxY)
	};
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
