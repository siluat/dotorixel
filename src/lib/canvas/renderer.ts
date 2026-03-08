import type { PixelCanvas } from './canvas.ts';
import type { ViewportConfig, ViewportSize } from './viewport.ts';
import { effectivePixelSize, getDisplaySize } from './viewport.ts';

const MIN_CHECKER_SIZE = 4;
const CHECKER_LIGHT = '#ffffff';
const CHECKER_DARK = '#e0e0e0';

function renderCheckerboard(
	ctx: CanvasRenderingContext2D,
	canvas: PixelCanvas,
	viewport: ViewportConfig
): void {
	const scaledPixel = effectivePixelSize(viewport);
	const checkerSize = Math.max(MIN_CHECKER_SIZE, Math.floor(scaledPixel / 2));
	const displaySize = getDisplaySize(canvas, viewport);
	const cols = Math.ceil(displaySize.width / checkerSize);
	const rows = Math.ceil(displaySize.height / checkerSize);

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			ctx.fillStyle = (col + row) % 2 === 0 ? CHECKER_LIGHT : CHECKER_DARK;
			ctx.fillRect(col * checkerSize, row * checkerSize, checkerSize, checkerSize);
		}
	}
}

function renderPixels(
	ctx: CanvasRenderingContext2D,
	canvas: PixelCanvas,
	viewport: ViewportConfig
): void {
	const displaySize = getDisplaySize(canvas, viewport);

	const offscreen = new OffscreenCanvas(canvas.width, canvas.height);
	const offCtx = offscreen.getContext('2d')!;
	const imageData = new ImageData(
		new Uint8ClampedArray(canvas.pixels),
		canvas.width,
		canvas.height
	);
	offCtx.putImageData(imageData, 0, 0);

	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(offscreen, 0, 0, displaySize.width, displaySize.height);
}

function renderGrid(
	ctx: CanvasRenderingContext2D,
	canvas: PixelCanvas,
	viewport: ViewportConfig
): void {
	if (!viewport.showGrid) return;

	const scaledPixel = effectivePixelSize(viewport);
	if (scaledPixel < 4) return;

	const displaySize = getDisplaySize(canvas, viewport);

	ctx.strokeStyle = viewport.gridColor;
	ctx.lineWidth = 1;
	ctx.beginPath();

	for (let x = 1; x < canvas.width; x++) {
		const px = x * scaledPixel + 0.5;
		ctx.moveTo(px, 0);
		ctx.lineTo(px, displaySize.height);
	}

	for (let y = 1; y < canvas.height; y++) {
		const py = y * scaledPixel + 0.5;
		ctx.moveTo(0, py);
		ctx.lineTo(displaySize.width, py);
	}

	ctx.stroke();
}

export function renderPixelCanvas(
	ctx: CanvasRenderingContext2D,
	canvas: PixelCanvas,
	viewport: ViewportConfig,
	viewportSize: ViewportSize
): void {
	ctx.clearRect(0, 0, viewportSize.width, viewportSize.height);

	ctx.save();
	ctx.translate(viewport.panX, viewport.panY);
	renderCheckerboard(ctx, canvas, viewport);
	renderPixels(ctx, canvas, viewport);
	renderGrid(ctx, canvas, viewport);
	ctx.restore();
}
