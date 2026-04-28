import type { Color } from '../canvas/color';

export interface DecodedImage {
	readonly width: number;
	readonly height: number;
	readonly data: Uint8ClampedArray;
}

export function samplePixel(image: DecodedImage, x: number, y: number): Color {
	const i = (y * image.width + x) * 4;
	return {
		r: image.data[i],
		g: image.data[i + 1],
		b: image.data[i + 2],
		a: image.data[i + 3]
	};
}
