export { type Color, TRANSPARENT, colorToHex, hexToColor } from './canvas/color.ts';

export {
	type CanvasSize,
	type PixelData,
	type PixelCanvas,
	createCanvas,
	createCanvasWithColor,
	getPixel,
	setPixel,
	isInsideBounds,
	clearCanvas,
	type CanvasCoords
} from './canvas/canvas.ts';

export {
	type ViewportConfig,
	type ViewportSize,
	getDefaultPixelSize,
	createDefaultViewport,
	getDisplaySize,
	screenToCanvas,
	effectivePixelSize,
	zoomAtPoint,
	pan,
	fitToViewport,
	ZOOM_LEVELS,
	nextZoomLevel,
	prevZoomLevel
} from './canvas/viewport.ts';

export { renderPixelCanvas } from './canvas/renderer.ts';

export { type ToolType, applyTool, interpolatePixels } from './canvas/tool.ts';

export { type HistoryManager, createHistoryManager } from './canvas/history.ts';
