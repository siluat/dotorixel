/**
 * Shifts pixel data by (dx, dy) within the same canvas dimensions.
 * Pixels shifted off-canvas are clipped; vacated areas become transparent.
 *
 * Uses row-by-row bulk copy — same algorithm as Rust's `resize_with_anchor`
 * but for same-size canvas with a fixed offset.
 */
export function shiftPixels(
	source: Uint8Array,
	width: number,
	height: number,
	dx: number,
	dy: number
): Uint8Array {
	const result = new Uint8Array(width * height * 4);

	for (let srcY = 0; srcY < height; srcY++) {
		const destY = srcY + dy;
		if (destY < 0 || destY >= height) continue;

		const srcXStart = Math.max(0, -dx);
		const srcXEnd = Math.min(width, width - dx);
		if (srcXStart >= srcXEnd) continue;

		const destXStart = srcXStart + dx;
		const copyLen = (srcXEnd - srcXStart) * 4;
		const srcOffset = (srcY * width + srcXStart) * 4;
		const destOffset = (destY * width + destXStart) * 4;
		result.set(source.subarray(srcOffset, srcOffset + copyLen), destOffset);
	}

	return result;
}
