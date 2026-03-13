export { type Color, TRANSPARENT, colorToHex, hexToColor } from './canvas/color.ts';

export {
	type PixelData,
	type PixelCanvas,
	createCanvas,
	createCanvasWithColor,
	resizeCanvas,
	isValidCanvasDimension,
	MIN_CANVAS_DIMENSION,
	MAX_CANVAS_DIMENSION,
	CANVAS_PRESETS,
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

export { exportAsPng, generateExportFilename } from './canvas/export.ts';

export { default as PixelPanel } from './ui/PixelPanel.svelte';
export { default as PixelButton } from './ui/PixelButton.svelte';
export { default as ColorSwatch } from './ui/ColorSwatch.svelte';
export { default as Toolbar } from './ui/Toolbar.svelte';
export { default as CanvasSettings } from './ui/CanvasSettings.svelte';
export { default as StatusBar } from './ui/StatusBar.svelte';
