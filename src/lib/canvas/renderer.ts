import { effectivePixelSize, type ViewportData, type ViewportSize } from './viewport';
import {
	normalizedQuarterTurn,
	referenceLayerUnderlayDocumentRect,
	type ReferenceLayerUnderlay
} from './reference-layer-underlay';
import type { OnionSkinGhostKind, OnionSkinGhostRead } from './editor-session/onion-skin';

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

// Onion Skin ghost treatment (218 spec): 60% of the kind tint blended over the
// ghost's own colors, blitted at 40% alpha. The tints mirror --ds-onion-prev /
// --ds-onion-next in design-tokens.css — single values, not theme-paired,
// because the canvas checkerboard they render on is theme-independent.
const ONION_SKIN_TINT_BLEND = 0.6;
const ONION_SKIN_GHOST_ALPHA = 0.4;
const ONION_SKIN_TINTS: Record<OnionSkinGhostKind, string> = {
	previous: '#E5484D',
	next: '#3B82F6'
};

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

/** Rasterizes a row-major RGBA buffer into a same-sized OffscreenCanvas. */
function rasterFromPixels(pixels: Uint8Array, width: number, height: number): OffscreenCanvas {
	const offscreen = new OffscreenCanvas(width, height);
	const offCtx = offscreen.getContext('2d')!;
	offCtx.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
	return offscreen;
}

function renderPixels(
	ctx: CanvasRenderingContext2D,
	canvas: RenderableCanvas,
	viewport: ViewportData
): void {
	const scaledPixel = effectivePixelSize(viewport);
	const displayWidth = canvas.width * scaledPixel;
	const displayHeight = canvas.height * scaledPixel;

	const offscreen = rasterFromPixels(canvas.pixels(), canvas.width, canvas.height);

	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(offscreen, 0, 0, displayWidth, displayHeight);
}

function tintedGhostRaster(ghost: OnionSkinGhostRead, canvas: RenderableCanvas): OffscreenCanvas {
	const offscreen = rasterFromPixels(ghost.pixels, canvas.width, canvas.height);
	const offCtx = offscreen.getContext('2d')!;
	// source-atop keeps the ghost's own alpha: transparent regions stay
	// transparent (checkerboard and Reference show through) while covered
	// pixels blend toward the kind tint.
	offCtx.globalCompositeOperation = 'source-atop';
	offCtx.globalAlpha = ONION_SKIN_TINT_BLEND;
	offCtx.fillStyle = ONION_SKIN_TINTS[ghost.kind];
	offCtx.fillRect(0, 0, canvas.width, canvas.height);
	return offscreen;
}

function renderOnionSkinGhosts(
	ctx: CanvasRenderingContext2D,
	canvas: RenderableCanvas,
	ghosts: readonly OnionSkinGhostRead[],
	viewport: ViewportData
): void {
	if (ghosts.length === 0) return;

	const scaledPixel = effectivePixelSize(viewport);
	const displayWidth = canvas.width * scaledPixel;
	const displayHeight = canvas.height * scaledPixel;

	// Farthest first, nearest last, so nearer neighbors read stronger where
	// ghosts overlap. The projection arrives in axis order; the sort is stable,
	// so equal distances keep that order.
	const drawOrder = [...ghosts].sort((a, b) => b.distance - a.distance);

	const previousAlpha = ctx.globalAlpha;
	ctx.imageSmoothingEnabled = false;
	ctx.globalAlpha = ONION_SKIN_GHOST_ALPHA;
	for (const ghost of drawOrder) {
		ctx.drawImage(tintedGhostRaster(ghost, canvas), 0, 0, displayWidth, displayHeight);
	}
	ctx.globalAlpha = previousAlpha;
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

	const offscreen = rasterFromPixels(
		reference.sourceRgba,
		reference.naturalWidth,
		reference.naturalHeight
	);
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

	const quarterTurns = normalizedQuarterTurn(reference.placement.rotation);
	if (quarterTurns === 0) {
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
	} else {
		// Turn the source about its (rotated) bounding-box center. The drawn
		// image keeps its un-rotated scaled dimensions; rotating a rect 90°
		// about its center lands it exactly inside the swapped-dimension box.
		const drawWidth = reference.naturalWidth * reference.placement.scale * scaledPixel;
		const drawHeight = reference.naturalHeight * reference.placement.scale * scaledPixel;
		ctx.translate(rect.left + rect.width / 2, rect.top + rect.height / 2);
		ctx.rotate((quarterTurns * Math.PI) / 2);
		ctx.drawImage(
			sourceRaster,
			0,
			0,
			reference.naturalWidth,
			reference.naturalHeight,
			-drawWidth / 2,
			-drawHeight / 2,
			drawWidth,
			drawHeight
		);
	}
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

/**
 * Renders one full frame of the canvas viewport onto `ctx`, in draw order:
 * checkerboard → Reference underlay (if given) → Onion Skin ghosts (farthest
 * first, nearest last) → pixel composite → grid. Ghosts and composite blit
 * nearest-neighbor at the viewport's effective pixel size; an empty ghost
 * list draws nothing extra.
 */
export function renderPixelCanvas(
	ctx: CanvasRenderingContext2D,
	canvas: RenderableCanvas,
	viewport: ViewportData,
	viewportSize: ViewportSize,
	referenceLayerUnderlay?: ReferenceLayerUnderlay,
	onionSkinGhosts: readonly OnionSkinGhostRead[] = []
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
	renderOnionSkinGhosts(ctx, canvas, onionSkinGhosts, viewport);
	renderPixels(ctx, canvas, viewport);
	renderGrid(ctx, canvas, viewport);
	ctx.restore();
}
