export interface WindowToImageCoordsParams {
	readonly localX: number;
	readonly localY: number;
	readonly displayedWidth: number;
	readonly displayedHeight: number;
	readonly naturalWidth: number;
	readonly naturalHeight: number;
}

/**
 * Map a pointer coord local to the displayed image into integer
 * image-natural pixel coords.
 *
 * Floor-then-clamp: `floor(local × natural / displayed)`, then clamp into
 * `[0, natural - 1]`. The clamp defends the trailing edge — a click on the
 * exact right or bottom border maps to `natural` before flooring and would
 * otherwise land at index `natural` (out of bounds). Negative drifts from
 * sub-pixel pointer events also collapse to `0`.
 *
 * Pure: no side effects. Caller must guarantee `displayedWidth > 0` and
 * `displayedHeight > 0` (i.e. the image is laid out before sampling).
 */
export function windowToImageCoords(p: WindowToImageCoordsParams): { x: number; y: number } {
	const rawX = Math.floor((p.localX * p.naturalWidth) / p.displayedWidth);
	const rawY = Math.floor((p.localY * p.naturalHeight) / p.displayedHeight);
	const x = Math.max(0, Math.min(p.naturalWidth - 1, rawX));
	const y = Math.max(0, Math.min(p.naturalHeight - 1, rawY));
	return { x, y };
}
