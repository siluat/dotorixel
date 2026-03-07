export {
	type Color,
	type CanvasSize,
	type PixelData,
	type PixelCanvas,
	TRANSPARENT,
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
	getDefaultPixelSize,
	createDefaultViewport,
	getDisplaySize,
	screenToCanvas,
	renderPixelCanvas
} from './canvas/renderer.ts';

export { type ToolType, applyTool, interpolatePixels } from './canvas/tool.ts';
