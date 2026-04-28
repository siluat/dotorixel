import type { Color } from '../canvas/color';

/**
 * Decodes a reference image Blob and returns the RGBA color at the given
 * image-natural coordinates. Caller must guarantee `0 <= x < naturalWidth`
 * and `0 <= y < naturalHeight` — produce these via `windowToImageCoords`.
 *
 * Stateless: no decode caching. Each call performs a fresh
 * `createImageBitmap` + `OffscreenCanvas.getImageData` for a single pixel
 * (4-byte buffer), so even multi-megapixel references stay cheap. If the
 * hot path ever needs multiple samples per decode, a per-reference cache
 * can layer behind this same signature without changing call sites.
 *
 * Throws if the Blob fails to decode (corrupt data or browser-side error).
 */
export async function samplePixel(blob: Blob, x: number, y: number): Promise<Color> {
	const bitmap = await createImageBitmap(blob);
	try {
		const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
		const ctx = offscreen.getContext('2d');
		if (!ctx) throw new Error('Failed to acquire 2D context for reference sampling');
		ctx.drawImage(bitmap, 0, 0);
		const { data } = ctx.getImageData(x, y, 1, 1);
		return { r: data[0], g: data[1], b: data[2], a: data[3] };
	} finally {
		bitmap.close();
	}
}
