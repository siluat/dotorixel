import { describe, expect, it } from 'vitest';
import { WasmDocument, WasmMarqueeRegion } from '$wasm/dotorixel_wasm';

const LAYER_ID = '00000000-0000-4000-8000-000000000001';

describe('WasmDocument', () => {
	it('rejects region compositing buffers whose length does not match the region', () => {
		const document = new WasmDocument(2, 2, LAYER_ID, 'Layer 1');
		const region = WasmMarqueeRegion.from_drag(0, 0, 1, 1);

		expect(() => document.composite_buffer_at(new Uint8Array(4), region)).toThrow(
			'Region buffer length must be 16 bytes'
		);
	});
});
