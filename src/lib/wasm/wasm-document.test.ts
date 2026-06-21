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

	it('throws when setting a frame duration with an invalid UUID or an unknown frame id', () => {
		const document = new WasmDocument(2, 2, LAYER_ID, 'Layer 1');

		// Not a UUID string at all.
		expect(() => document.set_frame_duration('not-a-uuid', 200)).toThrow();

		// A valid UUID, but no frame with that id is on the axis.
		const absentFrameId = '11111111-1111-4111-8111-111111111111';
		expect(() => document.set_frame_duration(absentFrameId, 200)).toThrow();
	});
});
