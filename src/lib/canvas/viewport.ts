import type { PixelCanvas, CanvasSize, CanvasCoords } from './canvas.ts';

export interface ViewportConfig {
	readonly pixelSize: number;
	readonly showGrid: boolean;
	readonly gridColor: string;
	readonly zoom: number;
	readonly panX: number;
	readonly panY: number;
}

export interface ViewportSize {
	readonly width: number;
	readonly height: number;
}

export const TARGET_DISPLAY_SIZE = 512;

export const ZOOM_LEVELS = [0.25, 0.5, 1, 2, 4, 8, 16] as const;

export function effectivePixelSize(viewport: ViewportConfig): number {
	return viewport.pixelSize * viewport.zoom;
}

export function screenToCanvas(
	screenX: number,
	screenY: number,
	viewport: ViewportConfig
): CanvasCoords {
	const scaledPixel = effectivePixelSize(viewport);
	return {
		x: Math.floor((screenX - viewport.panX) / scaledPixel),
		y: Math.floor((screenY - viewport.panY) / scaledPixel)
	};
}

export function getDefaultPixelSize(canvasSize: CanvasSize): number {
	return Math.floor(TARGET_DISPLAY_SIZE / canvasSize);
}

export function createDefaultViewport(canvasSize: CanvasSize): ViewportConfig {
	return {
		pixelSize: getDefaultPixelSize(canvasSize),
		showGrid: true,
		gridColor: '#cccccc',
		zoom: 1,
		panX: 0,
		panY: 0
	};
}

export function getDisplaySize(
	canvas: PixelCanvas,
	viewport: ViewportConfig
): ViewportSize {
	const scaledPixel = effectivePixelSize(viewport);
	return {
		width: canvas.width * scaledPixel,
		height: canvas.height * scaledPixel
	};
}

export function zoomAtPoint(
	viewport: ViewportConfig,
	screenX: number,
	screenY: number,
	newZoom: number
): ViewportConfig {
	const oldScaledPixel = effectivePixelSize(viewport);
	const newScaledPixel = viewport.pixelSize * newZoom;

	// Keep the canvas point under the cursor fixed:
	// screenX = panX + canvasX * scaledPixel  →  canvasX = (screenX - panX) / oldScaledPixel
	// New panX = screenX - canvasX * newScaledPixel
	const canvasX = (screenX - viewport.panX) / oldScaledPixel;
	const canvasY = (screenY - viewport.panY) / oldScaledPixel;

	return {
		...viewport,
		zoom: newZoom,
		panX: screenX - canvasX * newScaledPixel,
		panY: screenY - canvasY * newScaledPixel
	};
}

export function pan(
	viewport: ViewportConfig,
	deltaX: number,
	deltaY: number
): ViewportConfig {
	return {
		...viewport,
		panX: viewport.panX + deltaX,
		panY: viewport.panY + deltaY
	};
}

export function fitToViewport(
	viewport: ViewportConfig,
	canvas: PixelCanvas,
	viewportSize: ViewportSize
): ViewportConfig {
	const fitZoom = Math.min(
		viewportSize.width / (canvas.width * viewport.pixelSize),
		viewportSize.height / (canvas.height * viewport.pixelSize)
	);
	const scaledPixel = viewport.pixelSize * fitZoom;
	const panX = (viewportSize.width - canvas.width * scaledPixel) / 2;
	const panY = (viewportSize.height - canvas.height * scaledPixel) / 2;

	return { ...viewport, zoom: fitZoom, panX, panY };
}

export function nextZoomLevel(currentZoom: number): number {
	for (const level of ZOOM_LEVELS) {
		if (level > currentZoom + 1e-9) return level;
	}
	return ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
}

export function prevZoomLevel(currentZoom: number): number {
	for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
		if (ZOOM_LEVELS[i] < currentZoom - 1e-9) return ZOOM_LEVELS[i];
	}
	return ZOOM_LEVELS[0];
}
