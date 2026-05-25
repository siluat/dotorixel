import type { ViewportData, ViewportSize } from './viewport';
import {
	referenceLayerUnderlayDocumentRect,
	type ReferenceLayerUnderlay
} from './reference-layer-underlay';

/**
 * Minimal shape the renderer needs from a pixel buffer source — width,
 * height, and a row-major RGBA `pixels()` accessor. Satisfied by
 * `PixelCanvas` and by the `compositeBuffer` getter on `TabState`.
 */
export interface RenderableCanvas {
	readonly width: number;
	readonly height: number;
	pixels(): Uint8Array;
}

const MIN_CHECKER_SIZE = 4;
const MAX_REFERENCE_RASTER_CACHE_ENTRIES = 4;
const CHECKER_LIGHT = '#ffffff';
const CHECKER_DARK = '#e0e0e0';

const cachedReferenceRasters = new Map<string, OffscreenCanvas>();

/**
 * Clears the module-level `cachedReferenceRasters` lookup used by Reference underlay rendering.
 *
 * Takes no arguments, returns no value, and does not throw. Subsequent Reference raster
 * lookups will rebuild their cached `OffscreenCanvas` entries from source pixels.
 */
export function clearReferenceRasterCache(): void {
	cachedReferenceRasters.clear();
}

function effectivePixelSize(viewport: ViewportData): number {
	return Math.round(viewport.pixelSize * viewport.zoom);
}

function renderCheckerboard(
	ctx: CanvasRenderingContext2D,
	canvas: RenderableCanvas,
	viewport: ViewportData
): void {
	const scaledPixel = effectivePixelSize(viewport);

	if (scaledPixel < 2 * MIN_CHECKER_SIZE) {
		// At low zoom, one checker color per art pixel
		for (let y = 0; y < canvas.height; y++) {
			for (let x = 0; x < canvas.width; x++) {
				ctx.fillStyle = (x + y) % 2 === 0 ? CHECKER_LIGHT : CHECKER_DARK;
				ctx.fillRect(x * scaledPixel, y * scaledPixel, scaledPixel, scaledPixel);
			}
		}
		return;
	}

	// At higher zoom, 2×2 sub-checkerboard within each art pixel.
	// Aligned to pixel boundaries so checker edges never cross grid lines.
	// Every pixel uses the same layout (light at top-left), which produces
	// a correct global checkerboard because each pixel spans exactly
	// 2 sub-checker columns and 2 sub-checker rows.
	const half = Math.ceil(scaledPixel / 2);
	const rest = scaledPixel - half;

	for (let y = 0; y < canvas.height; y++) {
		for (let x = 0; x < canvas.width; x++) {
			const px = x * scaledPixel;
			const py = y * scaledPixel;

			ctx.fillStyle = CHECKER_LIGHT;
			ctx.fillRect(px, py, half, half);
			ctx.fillRect(px + half, py + half, rest, rest);

			ctx.fillStyle = CHECKER_DARK;
			ctx.fillRect(px + half, py, rest, half);
			ctx.fillRect(px, py + half, half, rest);
		}
	}
}

function renderPixels(
	ctx: CanvasRenderingContext2D,
	canvas: RenderableCanvas,
	viewport: ViewportData
): void {
	const scaledPixel = effectivePixelSize(viewport);
	const displayWidth = canvas.width * scaledPixel;
	const displayHeight = canvas.height * scaledPixel;

	const offscreen = new OffscreenCanvas(canvas.width, canvas.height);
	const offCtx = offscreen.getContext('2d')!;
	const imageData = new ImageData(
		new Uint8ClampedArray(canvas.pixels()),
		canvas.width,
		canvas.height
	);
	offCtx.putImageData(imageData, 0, 0);

	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(offscreen, 0, 0, displayWidth, displayHeight);
}

function referenceRasterKey(reference: ReferenceLayerUnderlay): string {
	return [
		reference.sourceKey,
		reference.naturalWidth,
		reference.naturalHeight,
		reference.sourceRgba.byteLength
	].join(':');
}

function referenceRaster(reference: ReferenceLayerUnderlay): OffscreenCanvas {
	const key = referenceRasterKey(reference);
	const cached = cachedReferenceRasters.get(key);
	if (cached) {
		cachedReferenceRasters.delete(key);
		cachedReferenceRasters.set(key, cached);
		return cached;
	}

	const offscreen = new OffscreenCanvas(reference.naturalWidth, reference.naturalHeight);
	const offCtx = offscreen.getContext('2d')!;
	const imageData = new ImageData(
		new Uint8ClampedArray(reference.sourceRgba),
		reference.naturalWidth,
		reference.naturalHeight
	);
	offCtx.putImageData(imageData, 0, 0);
	cachedReferenceRasters.set(key, offscreen);
	if (cachedReferenceRasters.size > MAX_REFERENCE_RASTER_CACHE_ENTRIES) {
		const oldestKey = cachedReferenceRasters.keys().next().value;
		if (oldestKey !== undefined) cachedReferenceRasters.delete(oldestKey);
	}
	return offscreen;
}

function renderReferenceLayerUnderlay(
	ctx: CanvasRenderingContext2D,
	canvas: RenderableCanvas,
	reference: ReferenceLayerUnderlay,
	viewport: ViewportData
): void {
	const opacity = reference.opacity;
	if (opacity <= 0) return;

	const scaledPixel = effectivePixelSize(viewport);
	const displayWidth = canvas.width * scaledPixel;
	const displayHeight = canvas.height * scaledPixel;
	const rect = referenceLayerUnderlayDocumentRect(reference, viewport);
	const sourceRaster = referenceRaster(reference);

	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, displayWidth, displayHeight);
	ctx.clip();
	const previousAlpha = ctx.globalAlpha;
	ctx.globalAlpha = Math.min(Math.max(opacity, 0), 1);
	ctx.imageSmoothingEnabled = true;
	ctx.drawImage(
		sourceRaster,
		0,
		0,
		reference.naturalWidth,
		reference.naturalHeight,
		rect.left,
		rect.top,
		rect.width,
		rect.height
	);
	ctx.globalAlpha = previousAlpha;
	ctx.restore();
}

function renderGrid(
	ctx: CanvasRenderingContext2D,
	canvas: RenderableCanvas,
	viewport: ViewportData
): void {
	if (!viewport.showGrid) return;

	const scaledPixel = effectivePixelSize(viewport);
	if (scaledPixel < 4) return;

	const displayWidth = canvas.width * scaledPixel;
	const displayHeight = canvas.height * scaledPixel;

	ctx.strokeStyle = viewport.gridColor;
	ctx.lineWidth = 1;
	ctx.beginPath();

	for (let x = 1; x < canvas.width; x++) {
		const px = x * scaledPixel + 0.5;
		ctx.moveTo(px, 0);
		ctx.lineTo(px, displayHeight);
	}

	for (let y = 1; y < canvas.height; y++) {
		const py = y * scaledPixel + 0.5;
		ctx.moveTo(0, py);
		ctx.lineTo(displayWidth, py);
	}

	ctx.stroke();
}

export function renderPixelCanvas(
	ctx: CanvasRenderingContext2D,
	canvas: RenderableCanvas,
	viewport: ViewportData,
	viewportSize: ViewportSize,
	referenceLayerUnderlay?: ReferenceLayerUnderlay
): void {
	ctx.clearRect(0, 0, viewportSize.width, viewportSize.height);

	ctx.save();
	// Round to integer physical pixels so that fillRect edges are crisp
	// and the grid's +0.5 trick produces sharp 1px lines.
	ctx.translate(Math.round(viewport.panX), Math.round(viewport.panY));
	renderCheckerboard(ctx, canvas, viewport);
	if (referenceLayerUnderlay) {
		renderReferenceLayerUnderlay(ctx, canvas, referenceLayerUnderlay, viewport);
	}
	renderPixels(ctx, canvas, viewport);
	renderGrid(ctx, canvas, viewport);
	ctx.restore();
}
