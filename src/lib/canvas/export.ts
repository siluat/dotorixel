interface PngEncodable {
	readonly width: number;
	readonly height: number;
	encode_png(): Uint8Array;
}

export function generateExportFilename(canvas: { width: number; height: number }): string {
	return `dotorixel-${canvas.width}x${canvas.height}.png`;
}

export function exportAsPng(canvas: PngEncodable, filename?: string): void {
	const bytes = canvas.encode_png();
	const blob = new Blob([bytes], { type: 'image/png' });
	const url = URL.createObjectURL(blob);

	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename ?? generateExportFilename(canvas);
	anchor.click();

	// Defer revocation so the browser can start the download before the URL is invalidated.
	// Immediate revocation after click() can silently cancel downloads in Firefox.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
