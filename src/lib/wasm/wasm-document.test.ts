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

		// Not a UUID string at all — fails in UUID parsing, before the axis lookup.
		expect(() => document.set_frame_duration('not-a-uuid', 200)).toThrow(/invalid character/);

		// A valid UUID, but no frame with that id is on the axis — reaches the
		// axis lookup and fails there, a distinct error path from the parse above.
		const absentFrameId = '11111111-1111-4111-8111-111111111111';
		expect(() => document.set_frame_duration(absentFrameId, 200)).toThrow(/not found/);
	});

	it('clamps a negative or out-of-range JS duration on its true magnitude, not a u32 wrap', () => {
		const document = new WasmDocument(2, 2, LAYER_ID, 'Layer 1');
		const frameId = document.active_frame_id();

		// A negative resolves to the minimum (1 ms) — not the maximum a u32 wrap
		// of -1 → 4294967295 would otherwise clamp to.
		document.set_frame_duration(frameId, -5);
		expect(document.frames_metadata()[0].duration_ms).toBe(1);

		// A value far above the u32 range still clamps to the maximum (no wrap).
		document.set_frame_duration(frameId, 1e9);
		expect(document.frames_metadata()[0].duration_ms).toBe(60_000);
	});
});
