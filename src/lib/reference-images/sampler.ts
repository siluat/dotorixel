import type { Color } from '../canvas/color';
import { samplePixel as samplePixelFromDecoded } from './sample-pixel';

/**
 * Decodes a reference image Blob and returns the RGBA color at the given
 * image-natural coordinates. Caller must guarantee `0 <= x < naturalWidth`
 * and `0 <= y < naturalHeight` — produce these via `windowToImageCoords`.
 *
 * Stateless: no decode caching. Each call performs a fresh
 * `createImageBitmap` + `OffscreenCanvas.getImageData`. For typical
 * reference images this is sub-millisecond on modern browsers; if hot-path
 * latency becomes a concern, a per-reference cache can layer behind this
 * same signature without changing call sites.
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
		const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
		return samplePixelFromDecoded(
			{ width: imageData.width, height: imageData.height, data: imageData.data },
			x,
			y
		);
	} finally {
		bitmap.close();
	}
}
