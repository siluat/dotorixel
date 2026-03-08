import type { PixelCanvas, CanvasSize, CanvasCoords } from './canvas.ts';

export interface ViewportConfig {
	readonly pixelSize: number;
	readonly showGrid: boolean;
	readonly gridColor: string;
}

export const TARGET_DISPLAY_SIZE = 512;

export function screenToCanvas(
	screenX: number,
	screenY: number,
	viewport: ViewportConfig
): CanvasCoords {
	return {
		x: Math.floor(screenX / viewport.pixelSize),
		y: Math.floor(screenY / viewport.pixelSize)
	};
}

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
