import { describe, expect, it } from 'vitest';
import { documentFromLayerSource } from '../canvas/wasm-backend';
import { compositeV3, type DocumentSchemaV3 } from './session-storage-types';

/**
 * `compositeV3` is a deliberate WASM-free parallel to the Rust core composite,
 * kept so the saved-work browser (landing route) can build thumbnails without
 * shipping the wasm bundle. These tests pin the two implementations together:
 * they share one source-over formula, so any output difference is confined to
 * Rust `f32` vs JS `f64` rounding (≤ 1 per channel). A real formula drift moves
 * a channel by far more than 1 and trips the tolerance.
 */

interface LayerSpec {
	readonly pixels: number[];
	readonly visible?: boolean;
	readonly opacity?: number;
}

function v3Schema(width: number, height: number, layers: readonly LayerSpec[]): DocumentSchemaV3 {
	const records = layers.map((layer) => ({
		id: crypto.randomUUID(),
		name: 'Layer',
		pixels: new Uint8Array(layer.pixels),
		visible: layer.visible ?? true,
		opacity: layer.opacity ?? 1
	}));
	return {
		schemaVersion: 3,
		id: 'parity-doc',
		name: 'Parity',
		width,
		height,
		layers: records,
		activeLayerId: records[0].id,
		nextLayerNumber: records.length + 1,
		timelinePanelCollapsed: false,
		saved: true,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		updatedAt: new Date('2026-01-01T00:00:00Z')
	};
}

/** The Rust core composite (f32) for the same layer stack `compositeV3` sees. */
function coreComposite(schema: DocumentSchemaV3): Uint8Array {
	return documentFromLayerSource(schema).composite();
}

describe('compositeV3 parity with the core composite', () => {
	it('matches the core exactly when every blend is integer-exact', () => {
		// Fully opaque layers at full opacity: a top pixel is either kept (alpha
		// 255) or fully transparent (alpha 0), so no fractional division happens
		// and f32 and f64 must agree byte-for-byte.
		const schema = v3Schema(2, 2, [
			{
				pixels: [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 128, 128, 128, 255]
			},
			{
				pixels: [0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 10, 20, 30, 255]
			}
		]);

		expect(coreComposite(schema)).toEqual(compositeV3(schema));
	});

	it('stays within one per channel across semi-transparent layers and opacities', () => {
		// Fractional source alpha and a fractional layer opacity make the two
		// implementations round independently; parity holds to ≤ 1 per channel.
		const schema = v3Schema(2, 2, [
			{
				pixels: [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]
			},
			{
				pixels: [10, 20, 30, 77, 200, 150, 100, 133, 0, 0, 0, 50, 255, 255, 255, 200],
				opacity: 0.6
			}
		]);

		const core = coreComposite(schema);
		const thumb = compositeV3(schema);

		expect(core.length).toBe(thumb.length);
		for (let i = 0; i < core.length; i++) {
			expect(Math.abs(core[i] - thumb[i])).toBeLessThanOrEqual(1);
		}
	});

	it('agrees on a stack that skips a hidden layer', () => {
		const schema = v3Schema(1, 2, [
			{ pixels: [255, 0, 0, 255, 0, 255, 0, 255] },
			{ pixels: [0, 0, 255, 255, 0, 0, 255, 255], visible: false }
		]);

		expect(coreComposite(schema)).toEqual(compositeV3(schema));
	});
});
