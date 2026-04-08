export interface ExportableCanvas {
	readonly width: number;
	readonly height: number;
}

interface PngEncodable extends ExportableCanvas {
	encode_png(): Uint8Array;
}

function isPngEncodable(canvas: ExportableCanvas): canvas is PngEncodable {
	return 'encode_png' in canvas;
}

interface SvgEncodable extends ExportableCanvas {
	encode_svg(): string;
}

function isSvgEncodable(canvas: ExportableCanvas): canvas is SvgEncodable {
	return 'encode_svg' in canvas;
}

export interface ExportFormat {
	id: string;
	label: string;
	extension: string;
	exportFn: (canvas: ExportableCanvas, filename: string) => void;
}

export const availableFormats: ExportFormat[] = [
	{ id: 'png', label: 'PNG', extension: 'png', exportFn: exportAsPng },
	{ id: 'svg', label: 'SVG', extension: 'svg', exportFn: exportAsSvg }
];

export function generateDefaultStem(canvas: { width: number; height: number }): string {
	return `dotorixel-${canvas.width}x${canvas.height}`;
}

export function generateExportFilename(canvas: { width: number; height: number }): string {
	return `${generateDefaultStem(canvas)}.png`;
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
	const effectiveStem = stem.trim() || generateDefaultStem(canvas);
	return `${effectiveStem}.${extension}`;
}

export function exportAsPng(canvas: ExportableCanvas, filename?: string): void {
	if (!isPngEncodable(canvas)) return;
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

export function exportAsSvg(canvas: ExportableCanvas, filename?: string): void {
	if (!isSvgEncodable(canvas)) return;
	const svg = canvas.encode_svg();
	const blob = new Blob([svg], { type: 'image/svg+xml' });
	const url = URL.createObjectURL(blob);

	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename ?? `${generateDefaultStem(canvas)}.svg`;
	anchor.click();

	setTimeout(() => URL.revokeObjectURL(url), 0);
}
