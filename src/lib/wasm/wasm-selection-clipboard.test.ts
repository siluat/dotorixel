import { describe, it, expect } from 'vitest';
import { WasmSelectionClipboard } from '$wasm/dotorixel_wasm';

describe('WasmSelectionClipboard', () => {
	it('exposes clipboard dimensions and pixel bytes', () => {
		const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);
		const clipboard = new WasmSelectionClipboard(pixels, 2, 1);
		pixels[0] = 0;

		expect(clipboard.width).toBe(2);
		expect(clipboard.height).toBe(1);
		expect(clipboard.pixels()).toEqual(
			new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255])
		);
	});
});
