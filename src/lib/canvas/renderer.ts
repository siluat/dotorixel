import type { PixelCanvas, CanvasSize } from './canvas.ts';

export interface ViewportConfig {
	readonly pixelSize: number;
	readonly showGrid: boolean;
	readonly gridColor: string;
}

const TARGET_DISPLAY_SIZE = 512;
const MIN_CHECKER_SIZE = 4;
const CHECKER_LIGHT = '#ffffff';
const CHECKER_DARK = '#e0e0e0';

export function getDefaultPixelSize(canvasSize: CanvasSize): number {
	return Math.floor(TARGET_DISPLAY_SIZE / canvasSize);
}

export function createDefaultViewport(canvasSize: CanvasSize): ViewportConfig {
	return {
		pixelSize: getDefaultPixelSize(canvasSize),
		showGrid: true,
		gridColor: '#cccccc'
	};
}

export function getDisplaySize(
	canvas: PixelCanvas,
	viewport: ViewportConfig
): { width: number; height: number } {
	return {
		width: canvas.width * viewport.pixelSize,
		height: canvas.height * viewport.pixelSize
	};
}

function renderCheckerboard(
	ctx: CanvasRenderingContext2D,
	canvas: PixelCanvas,
	viewport: ViewportConfig
): void {
	const checkerSize = Math.max(MIN_CHECKER_SIZE, Math.floor(viewport.pixelSize / 2));
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

	const displaySize = getDisplaySize(canvas, viewport);
	const { pixelSize } = viewport;

	ctx.strokeStyle = viewport.gridColor;
	ctx.lineWidth = 1;
	ctx.beginPath();

	for (let x = 1; x < canvas.width; x++) {
		const px = x * pixelSize + 0.5;
		ctx.moveTo(px, 0);
		ctx.lineTo(px, displaySize.height);
	}

	for (let y = 1; y < canvas.height; y++) {
		const py = y * pixelSize + 0.5;
		ctx.moveTo(0, py);
		ctx.lineTo(displaySize.width, py);
	}

	ctx.stroke();
}

export function renderPixelCanvas(
	ctx: CanvasRenderingContext2D,
	canvas: PixelCanvas,
	viewport: ViewportConfig
): void {
	const displaySize = getDisplaySize(canvas, viewport);
	ctx.clearRect(0, 0, displaySize.width, displaySize.height);
	renderCheckerboard(ctx, canvas, viewport);
	renderPixels(ctx, canvas, viewport);
	renderGrid(ctx, canvas, viewport);
}
