export interface Color {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly a: number;
}

export type CanvasSize = 8 | 16 | 32;

export type PixelData = Uint8ClampedArray;

export interface PixelCanvas {
	readonly width: CanvasSize;
	readonly height: CanvasSize;
	readonly pixels: PixelData;
}

export const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

function pixelIndex(width: number, x: number, y: number): number {
	return (y * width + x) * 4;
}

export function createCanvas(size: CanvasSize): PixelCanvas {
	return {
		width: size,
		height: size,
		pixels: new Uint8ClampedArray(size * size * 4)
	};
}

export function createCanvasWithColor(size: CanvasSize, color: Color): PixelCanvas {
	const pixels = new Uint8ClampedArray(size * size * 4);
	for (let i = 0; i < pixels.length; i += 4) {
		pixels[i] = color.r;
		pixels[i + 1] = color.g;
		pixels[i + 2] = color.b;
		pixels[i + 3] = color.a;
	}
	return { width: size, height: size, pixels };
}

export function isInsideBounds(canvas: PixelCanvas, x: number, y: number): boolean {
	return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < canvas.width && y < canvas.height;
}

export function getPixel(canvas: PixelCanvas, x: number, y: number): Color {
	if (!isInsideBounds(canvas, x, y)) {
		throw new RangeError(
			`Pixel coordinates (${x}, ${y}) are out of bounds for ${canvas.width}x${canvas.height} canvas`
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

export function setPixel(canvas: PixelCanvas, x: number, y: number, color: Color): void {
	if (!isInsideBounds(canvas, x, y)) {
		throw new RangeError(
			`Pixel coordinates (${x}, ${y}) are out of bounds for ${canvas.width}x${canvas.height} canvas`
		);
	}
	const i = pixelIndex(canvas.width, x, y);
	canvas.pixels[i] = color.r;
	canvas.pixels[i + 1] = color.g;
	canvas.pixels[i + 2] = color.b;
	canvas.pixels[i + 3] = color.a;
}
