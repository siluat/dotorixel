import type { ViewportData, ViewportSize } from './view-types';

interface RenderableCanvas {
	readonly width: number;
	readonly height: number;
	pixels(): Uint8Array;
}

const MIN_CHECKER_SIZE = 4;
const CHECKER_LIGHT = '#ffffff';
const CHECKER_DARK = '#e0e0e0';

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
	viewportSize: ViewportSize
): void {
	ctx.clearRect(0, 0, viewportSize.width, viewportSize.height);

	ctx.save();
	// Round to integer physical pixels so that fillRect edges are crisp
	// and the grid's +0.5 trick produces sharp 1px lines.
	ctx.translate(Math.round(viewport.panX), Math.round(viewport.panY));
	renderCheckerboard(ctx, canvas, viewport);
	renderPixels(ctx, canvas, viewport);
	renderGrid(ctx, canvas, viewport);
	ctx.restore();
}
