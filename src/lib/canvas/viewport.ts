import type { PixelCanvas, CanvasCoords } from './canvas.ts';

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

export const MIN_ZOOM = ZOOM_LEVELS[0];
export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

export const MIN_VISIBLE_MARGIN = 16;

export function clampZoom(zoom: number): number {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

const PINCH_ZOOM_SENSITIVITY = 0.01;

export function computePinchZoom(currentZoom: number, deltaY: number): number {
	// Negate deltaY: WheelEvent deltaY > 0 means "scroll down" / "zoom out",
	// but we need scale > 1 for zoom-in, so invert the sign.
	const scale = Math.exp(-deltaY * PINCH_ZOOM_SENSITIVITY);
	return clampZoom(currentZoom * scale);
}

export function effectivePixelSize(viewport: ViewportConfig): number {
	// Round to integer so every coordinate derived from scaledPixel
	// (pixel positions, grid lines, display size) lands on whole pixels.
	// Continuous zoom (pinch) produces non-integer values that would
	// otherwise cause subpixel misalignment across rendering functions.
	return Math.round(viewport.pixelSize * viewport.zoom);
}

export function screenToCanvas(
	screenX: number,
	screenY: number,
	viewport: ViewportConfig
): CanvasCoords {
	const scaledPixel = effectivePixelSize(viewport);
	// Use rounded panX/panY to match the renderer's ctx.translate(Math.round(...)).
	return {
		x: Math.floor((screenX - Math.round(viewport.panX)) / scaledPixel),
		y: Math.floor((screenY - Math.round(viewport.panY)) / scaledPixel)
	};
}

export function getDefaultPixelSize(width: number, height: number): number {
	return Math.floor(TARGET_DISPLAY_SIZE / Math.max(width, height));
}

export function createDefaultViewport(width: number, height: number): ViewportConfig {
	return {
		pixelSize: getDefaultPixelSize(width, height),
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
	// Must use the same rounding as effectivePixelSize so that pan offset
	// matches actual rendering positions. Without this, the content drifts
	// from the cursor anchor during continuous (pinch) zoom.
	const newScaledPixel = Math.round(viewport.pixelSize * newZoom);

	// Keep the canvas point under the cursor fixed:
	// screenX = panX + canvasX * scaledPixel  →  canvasX = (screenX - panX) / oldScaledPixel
	// New panX = screenX - canvasX * newScaledPixel
	// Use rounded panX/panY to match the renderer's ctx.translate(Math.round(...)).
	const canvasX = (screenX - Math.round(viewport.panX)) / oldScaledPixel;
	const canvasY = (screenY - Math.round(viewport.panY)) / oldScaledPixel;

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

export function clampPan(
	viewport: ViewportConfig,
	canvas: PixelCanvas,
	viewportSize: ViewportSize
): ViewportConfig {
	const scaledPixel = effectivePixelSize(viewport);
	const margin = Math.max(scaledPixel, MIN_VISIBLE_MARGIN);
	const canvasDisplayWidth = canvas.width * scaledPixel;
	const canvasDisplayHeight = canvas.height * scaledPixel;

	// When the canvas fits inside the viewport, keep it fully contained.
	// When it overflows, allow panning but keep at least margin pixels visible.
	const minPanX =
		canvasDisplayWidth <= viewportSize.width ? 0 : margin - canvasDisplayWidth;
	const maxPanX =
		canvasDisplayWidth <= viewportSize.width
			? viewportSize.width - canvasDisplayWidth
			: viewportSize.width - margin;
	const minPanY =
		canvasDisplayHeight <= viewportSize.height ? 0 : margin - canvasDisplayHeight;
	const maxPanY =
		canvasDisplayHeight <= viewportSize.height
			? viewportSize.height - canvasDisplayHeight
			: viewportSize.height - margin;

	const clampedPanX = Math.min(maxPanX, Math.max(minPanX, viewport.panX));
	const clampedPanY = Math.min(maxPanY, Math.max(minPanY, viewport.panY));

	if (clampedPanX === viewport.panX && clampedPanY === viewport.panY) {
		return viewport;
	}

	return { ...viewport, panX: clampedPanX, panY: clampedPanY };
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
	const scaledPixel = Math.round(viewport.pixelSize * fitZoom);
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
