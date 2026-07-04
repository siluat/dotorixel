import { format_spritesheet } from '$lib/paraglide/messages';

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

/**
 * The whole Document handed to multi-frame formats. Minimal on purpose —
 * mirrors {@link ExportableCanvas}: each format narrows to the encoder
 * methods it needs at runtime.
 */
export interface ExportableDocument {
	readonly width: number;
	readonly height: number;
}

interface SpritesheetEncodable extends ExportableDocument {
	encode_spritesheet_png(): Uint8Array;
}

function isSpritesheetEncodable(doc: ExportableDocument): doc is SpritesheetEncodable {
	return 'encode_spritesheet_png' in doc;
}

interface ExportFormatCommon {
	id: string;
	/**
	 * Display name resolved lazily so localized labels are read at render
	 * time, after the locale is known — never captured at module init.
	 */
	label: () => string;
	extension: string;
	/**
	 * Default filename stem used when the typed stem is empty. Declared by
	 * formats whose default must not collide with another format sharing the
	 * same extension (e.g. the spritesheet vs the still PNG); omitted formats
	 * fall back to {@link generateDefaultStem}.
	 */
	defaultStem?: (dims: { width: number; height: number }) => string;
}

/** A format fed by the active-frame composite snapshot (still image). */
export interface StillExportFormat extends ExportFormatCommon {
	source: 'still';
	exportFn: (canvas: ExportableCanvas, filename: string) => void;
}

/** A format fed by the whole Document (multi-frame output). */
export interface DocumentExportFormat extends ExportFormatCommon {
	source: 'document';
	exportFn: (document: ExportableDocument, filename: string) => void;
}

/**
 * A registry entry declaring which source its `exportFn` consumes — a still
 * snapshot or the whole Document. {@link exportAs} resolves the declared
 * source and dispatches.
 */
export type ExportFormat = StillExportFormat | DocumentExportFormat;

export const availableFormats: ExportFormat[] = [
	{ id: 'png', label: () => 'PNG', extension: 'png', source: 'still', exportFn: exportAsPng },
	{ id: 'svg', label: () => 'SVG', extension: 'svg', source: 'still', exportFn: exportAsSvg },
	{
		id: 'spritesheet',
		label: format_spritesheet,
		extension: 'png',
		source: 'document',
		exportFn: exportAsSpritesheet,
		defaultStem: spritesheetDefaultStem
	}
];

/** Sheet-marked stem shared by the registry default and the direct-call fallback. */
function spritesheetDefaultStem(dims: { width: number; height: number }): string {
	return `${generateDefaultStem(dims)}-sheet`;
}

/**
 * Lazy providers for the export sources. `exportAs` calls only the thunk the
 * format declares, so the unused source is never materialized (building a
 * still snapshot costs a full composite).
 */
export interface ExportSources {
	still(): ExportableCanvas;
	document(): ExportableDocument;
}

/**
 * Runs one export: cleans the typed filename stem, resolves the format's
 * declared source, assembles the final filename, and hands both to the
 * format's `exportFn`. Returns the resolved source's dimensions so callers
 * can record analytics without re-deriving them.
 */
export function exportAs(
	format: ExportFormat,
	filenameStem: string,
	sources: ExportSources
): { width: number; height: number } {
	const knownExtensions = availableFormats.map((f) => f.extension);
	const cleanStem = stripKnownExtension(filenameStem.trim(), knownExtensions);
	const defaultStem = format.defaultStem ?? generateDefaultStem;
	if (format.source === 'still') {
		const canvas = sources.still();
		format.exportFn(canvas, buildExportFilename(cleanStem, format.extension, defaultStem(canvas)));
		return { width: canvas.width, height: canvas.height };
	}
	const doc = sources.document();
	format.exportFn(doc, buildExportFilename(cleanStem, format.extension, defaultStem(doc)));
	return { width: doc.width, height: doc.height };
}

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
	fallbackStem: string
): string {
	const effectiveStem = stem.trim() || fallbackStem;
	return `${effectiveStem}.${extension}`;
}

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);

	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.click();

	// Defer revocation so the browser can start the download before the URL is invalidated.
	// Immediate revocation after click() can silently cancel downloads in Firefox.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportAsPng(canvas: ExportableCanvas, filename?: string): void {
	if (!isPngEncodable(canvas)) return;
	const bytes = canvas.encode_png();
	const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
	downloadBlob(blob, filename ?? generateExportFilename(canvas));
}

export function exportAsSpritesheet(doc: ExportableDocument, filename?: string): void {
	if (!isSpritesheetEncodable(doc)) return;
	const bytes = doc.encode_spritesheet_png();
	const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
	downloadBlob(blob, filename ?? `${spritesheetDefaultStem(doc)}.png`);
}

export function exportAsSvg(canvas: ExportableCanvas, filename?: string): void {
	if (!isSvgEncodable(canvas)) return;
	const svg = canvas.encode_svg();
	const blob = new Blob([svg], { type: 'image/svg+xml' });
	downloadBlob(blob, filename ?? `${generateDefaultStem(canvas)}.svg`);
}
