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
	getDefaultPixelSize,
	createDefaultViewport,
	getDisplaySize,
	screenToCanvas,
	renderPixelCanvas
} from './canvas/renderer.ts';

export { type ToolType, applyTool, interpolatePixels } from './canvas/tool.ts';
