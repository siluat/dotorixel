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
	isInsideBounds
} from './canvas/canvas.ts';

export {
	type ViewportConfig,
	getDefaultPixelSize,
	createDefaultViewport,
	getDisplaySize,
	renderPixelCanvas
} from './canvas/renderer.ts';
