export interface ExportableCanvas {
	readonly width: number;
	readonly height: number;
}

interface PngEncodable extends ExportableCanvas {
	encode_png(): Uint8Array;
}

export interface ExportFormat {
	id: string;
	label: string;
	extension: string;
	exportFn: (canvas: ExportableCanvas, filename: string) => void;
}

export const availableFormats: ExportFormat[] = [
	{
		id: 'png',
		label: 'PNG',
		extension: 'png',
		exportFn: (canvas, filename) => exportAsPng(canvas as PngEncodable, filename)
	}
];

export function generateExportFilename(canvas: { width: number; height: number }): string {
	return `dotorixel-${canvas.width}x${canvas.height}.png`;
}

export function stripKnownExtension(input: string, knownExtensions: string[]): string {
	const dotIndex = input.lastIndexOf('.');
	if (dotIndex === -1) return input;
	const ext = input.slice(dotIndex + 1).toLowerCase();
	if (knownExtensions.includes(ext)) return input.slice(0, dotIndex);
	return input;
}

export function buildExportFilename(
	stem: string,
	extension: string,
	canvas: { width: number; height: number }
): string {
	const effectiveStem = stem.trim() || `dotorixel-${canvas.width}x${canvas.height}`;
	return `${effectiveStem}.${extension}`;
}

export function exportAsPng(canvas: PngEncodable, filename?: string): void {
	const bytes = canvas.encode_png();
	const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
	const url = URL.createObjectURL(blob);

	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename ?? generateExportFilename(canvas);
	anchor.click();

	// Defer revocation so the browser can start the download before the URL is invalidated.
	// Immediate revocation after click() can silently cancel downloads in Firefox.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
