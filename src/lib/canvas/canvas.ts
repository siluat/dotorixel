import type { Color } from './color.ts';

export type PixelData = Uint8ClampedArray;

export interface PixelCanvas {
	readonly width: number;
	readonly height: number;
	readonly pixels: PixelData;
}

export const MIN_CANVAS_DIMENSION = 1;
export const MAX_CANVAS_DIMENSION = 128;
export const CANVAS_PRESETS = [8, 16, 32, 64] as const;

export function isValidCanvasDimension(value: number): boolean {
	return (
		Number.isInteger(value) &&
		value >= MIN_CANVAS_DIMENSION &&
		value <= MAX_CANVAS_DIMENSION
	);
}

export interface CanvasCoords {
	readonly x: number;
	readonly y: number;
}

function pixelIndex(width: number, x: number, y: number): number {
	return (y * width + x) * 4;
}

export function createCanvas(width: number, height: number): PixelCanvas {
	return {
		width,
		height,
		pixels: new Uint8ClampedArray(width * height * 4)
	};
}

export function createCanvasWithColor(width: number, height: number, color: Color): PixelCanvas {
	const pixels = new Uint8ClampedArray(width * height * 4);
	for (let i = 0; i < pixels.length; i += 4) {
		pixels[i] = color.r;
		pixels[i + 1] = color.g;
		pixels[i + 2] = color.b;
		pixels[i + 3] = color.a;
	}
	return { width, height, pixels };
}

export function resizeCanvas(source: PixelCanvas, newWidth: number, newHeight: number): PixelCanvas {
	const dest = createCanvas(newWidth, newHeight);
	const copyWidth = Math.min(source.width, newWidth);
	const copyHeight = Math.min(source.height, newHeight);
	for (let y = 0; y < copyHeight; y++) {
		const srcOffset = y * source.width * 4;
		const destOffset = y * newWidth * 4;
		dest.pixels.set(
			source.pixels.subarray(srcOffset, srcOffset + copyWidth * 4),
			destOffset
		);
	}
	return dest;
}

export function isInsideBounds(canvas: PixelCanvas, x: number, y: number): boolean {
	return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < canvas.width && y < canvas.height;
}

export function getPixel(canvas: PixelCanvas, x: number, y: number): Color {
	if (!isInsideBounds(canvas, x, y)) {
		throw new RangeError(
			`Pixel coordinates (${x}, ${y}) are out of bounds for ${canvas.width}x${canvas.height} canvas. ` +
				`Valid range: x in [0, ${canvas.width - 1}], y in [0, ${canvas.height - 1}]`
		);
	}
	const i = pixelIndex(canvas.width, x, y);
	return {
		r: canvas.pixels[i],
		g: canvas.pixels[i + 1],
		b: canvas.pixels[i + 2],
		a: canvas.pixels[i + 3]
	};
}

export function clearCanvas(canvas: PixelCanvas): void {
	canvas.pixels.fill(0);
}

export function setPixel(canvas: PixelCanvas, x: number, y: number, color: Color): void {
	if (!isInsideBounds(canvas, x, y)) {
		throw new RangeError(
			`Pixel coordinates (${x}, ${y}) are out of bounds for ${canvas.width}x${canvas.height} canvas. ` +
				`Valid range: x in [0, ${canvas.width - 1}], y in [0, ${canvas.height - 1}]`
		);
	}
	const i = pixelIndex(canvas.width, x, y);
	canvas.pixels[i] = color.r;
	canvas.pixels[i + 1] = color.g;
	canvas.pixels[i + 2] = color.b;
	canvas.pixels[i + 3] = color.a;
}
