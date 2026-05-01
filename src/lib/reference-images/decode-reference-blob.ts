import type { DecodedImage } from './sample-pixel';

/**
 * Decode a reference image Blob into a synchronous RGBA buffer for repeated
 * sampling — the loupe path reads dozens of pixels per pointer move, and
 * paying `createImageBitmap` per sample (as `sampler.samplePixel` does) is
 * wasteful for that hot loop. Decode once on long-press start; sample
 * synchronously thereafter.
 *
 * Throws if the Blob fails to decode (corrupt data, unsupported format,
 * or browser-side OffscreenCanvas/getImageData failure). Callers should
 * treat a rejected promise as "no sampling possible" and silently no-op.
 */
export async function decodeReferenceBlob(blob: Blob): Promise<DecodedImage> {
	const bitmap = await createImageBitmap(blob);
	try {
		const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
		const ctx = offscreen.getContext('2d');
		if (!ctx) throw new Error('Failed to acquire 2D context for reference decode');
		ctx.drawImage(bitmap, 0, 0);
		const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
		return {
			width: bitmap.width,
			height: bitmap.height,
			data: imageData.data
		};
	} finally {
		bitmap.close();
	}
}
