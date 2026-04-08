import { describe, it, expect } from 'vitest';
import { shiftPixels } from './move-tool';

function createBuffer(width: number, height: number, fill?: number[]): Uint8Array {
	const buf = new Uint8Array(width * height * 4);
	if (fill) {
		for (let i = 0; i < buf.length; i += 4) {
			buf[i] = fill[0];
			buf[i + 1] = fill[1];
			buf[i + 2] = fill[2];
			buf[i + 3] = fill[3];
		}
	}
	return buf;
}

function setPixel(buf: Uint8Array, width: number, x: number, y: number, rgba: number[]): void {
	const i = (y * width + x) * 4;
	buf[i] = rgba[0];
	buf[i + 1] = rgba[1];
	buf[i + 2] = rgba[2];
	buf[i + 3] = rgba[3];
}

function getPixel(buf: Uint8Array, width: number, x: number, y: number): number[] {
	const i = (y * width + x) * 4;
	return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
}

const RED = [255, 0, 0, 255];
const TRANSPARENT = [0, 0, 0, 0];

describe('shiftPixels', () => {
	it('returns identical output for zero offset', () => {
		const src = createBuffer(4, 4, RED);
		const result = shiftPixels(src, 4, 4, 0, 0);
		expect(result).toEqual(src);
	});

	it('shifts content right by 1', () => {
		const src = createBuffer(4, 4);
		setPixel(src, 4, 0, 0, RED);

		const result = shiftPixels(src, 4, 4, 1, 0);

		expect(getPixel(result, 4, 0, 0)).toEqual(TRANSPARENT);
		expect(getPixel(result, 4, 1, 0)).toEqual(RED);
	});

	it('shifts content down by 1', () => {
		const src = createBuffer(4, 4);
		setPixel(src, 4, 2, 0, RED);

		const result = shiftPixels(src, 4, 4, 0, 1);

		expect(getPixel(result, 4, 2, 0)).toEqual(TRANSPARENT);
		expect(getPixel(result, 4, 2, 1)).toEqual(RED);
	});

	it('shifts content left (negative dx)', () => {
		const src = createBuffer(4, 4);
		setPixel(src, 4, 3, 1, RED);

		const result = shiftPixels(src, 4, 4, -2, 0);

		expect(getPixel(result, 4, 1, 1)).toEqual(RED);
		expect(getPixel(result, 4, 3, 1)).toEqual(TRANSPARENT);
	});

	it('shifts content up (negative dy)', () => {
		const src = createBuffer(4, 4);
		setPixel(src, 4, 1, 3, RED);

		const result = shiftPixels(src, 4, 4, 0, -2);

		expect(getPixel(result, 4, 1, 1)).toEqual(RED);
		expect(getPixel(result, 4, 1, 3)).toEqual(TRANSPARENT);
	});

	it('clips pixels shifted entirely off canvas', () => {
		const src = createBuffer(4, 4, RED);
		const result = shiftPixels(src, 4, 4, 4, 0);

		for (let y = 0; y < 4; y++) {
			for (let x = 0; x < 4; x++) {
				expect(getPixel(result, 4, x, y)).toEqual(TRANSPARENT);
			}
		}
	});

	it('clips pixels shifted entirely off canvas (negative)', () => {
		const src = createBuffer(4, 4, RED);
		const result = shiftPixels(src, 4, 4, 0, -4);

		for (let y = 0; y < 4; y++) {
			for (let x = 0; x < 4; x++) {
				expect(getPixel(result, 4, x, y)).toEqual(TRANSPARENT);
			}
		}
	});

	it('handles diagonal shift with partial clipping', () => {
		const src = createBuffer(4, 4);
		setPixel(src, 4, 0, 0, RED);
		setPixel(src, 4, 3, 3, RED);

		const result = shiftPixels(src, 4, 4, 2, 2);

		expect(getPixel(result, 4, 2, 2)).toEqual(RED);
		// (3,3) shifted to (5,5) — clipped
		expect(getPixel(result, 4, 3, 3)).toEqual(TRANSPARENT);
	});

	it('does not mutate the source buffer', () => {
		const src = createBuffer(4, 4);
		setPixel(src, 4, 0, 0, RED);
		const srcCopy = new Uint8Array(src);

		shiftPixels(src, 4, 4, 1, 1);

		expect(src).toEqual(srcCopy);
	});
});
