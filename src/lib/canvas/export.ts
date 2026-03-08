import type { PixelCanvas } from './canvas.ts';

export function generateExportFilename(canvas: PixelCanvas): string {
	return `dotorixel-${canvas.width}x${canvas.height}.png`;
}

export async function exportAsPng(canvas: PixelCanvas, filename?: string): Promise<void> {
	const offscreen = new OffscreenCanvas(canvas.width, canvas.height);
	const ctx = offscreen.getContext('2d')!;
	const imageData = new ImageData(
		new Uint8ClampedArray(canvas.pixels),
		canvas.width,
		canvas.height
	);
	ctx.putImageData(imageData, 0, 0);

	const blob = await offscreen.convertToBlob({ type: 'image/png' });
	const url = URL.createObjectURL(blob);

	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename ?? generateExportFilename(canvas);
	anchor.click();

	// Defer revocation so the browser can start the download before the URL is invalidated.
	// Immediate revocation after click() can silently cancel downloads in Firefox.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
