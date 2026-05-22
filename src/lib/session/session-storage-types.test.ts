import { describe, expect, it } from 'vitest';
import { migrateV3ToV4 } from './session-storage-types';
import type {
	DocumentSchemaV3,
	DocumentSchemaV4,
	PixelLayerRecord,
	ReferenceLayerRecord
} from './session-storage-types';

function makeV3(overrides: Partial<DocumentSchemaV3> = {}): DocumentSchemaV3 {
	const bottomId = crypto.randomUUID();
	const topId = crypto.randomUUID();
	const bottomPixels = new Uint8Array([255, 0, 0, 255]);
	const topPixels = new Uint8Array([0, 0, 255, 128]);
	const base: DocumentSchemaV3 = {
		schemaVersion: 3,
		id: 'doc-v3',
		name: 'V3 document',
		width: 1,
		height: 1,
		layers: [
			{
				id: bottomId,
				name: 'Bottom',
				pixels: bottomPixels,
				visible: true,
				opacity: 1
			},
			{
				id: topId,
				name: 'Top',
				pixels: topPixels,
				visible: false,
				opacity: 0.5
			}
		],
		activeLayerId: topId,
		nextLayerNumber: 7,
		timelinePanelCollapsed: true,
		saved: true,
		createdAt: new Date('2026-05-01T00:00:00Z'),
		updatedAt: new Date('2026-05-02T00:00:00Z')
	};
	return { ...base, ...overrides };
}

describe('migrateV3ToV4', () => {
	it('wraps every V3 layer as a Pixel Layer without losing pixels or metadata', () => {
		const v3 = makeV3();

		const v4 = migrateV3ToV4(v3);

		expect(v4.schemaVersion).toBe(4);
		expect(v4.layers).toHaveLength(2);
		expect(v4.layers.map((layer) => layer.kind)).toEqual(['pixel', 'pixel']);
		const pixelLayers = v4.layers.filter(
			(layer): layer is PixelLayerRecord => layer.kind === 'pixel'
		);
		expect(pixelLayers[0]).toMatchObject({
			id: v3.layers[0].id,
			name: 'Bottom',
			visible: true,
			opacity: 1
		});
		expect(pixelLayers[1]).toMatchObject({
			id: v3.layers[1].id,
			name: 'Top',
			visible: false,
			opacity: 0.5
		});
		expect(pixelLayers[0].pixels).toEqual(v3.layers[0].pixels);
		expect(pixelLayers[1].pixels).toEqual(v3.layers[1].pixels);
	});

	it('preserves document fields and leaves history absent', () => {
		const v3 = makeV3({
			width: 64,
			height: 32,
			activeLayerId: 'active-layer',
			nextLayerNumber: 12,
			timelinePanelCollapsed: false,
			saved: false
		});

		const v4 = migrateV3ToV4(v3);

		expect(v4).toMatchObject({
			id: 'doc-v3',
			name: 'V3 document',
			width: 64,
			height: 32,
			activeLayerId: 'active-layer',
			nextLayerNumber: 12,
			timelinePanelCollapsed: false,
			saved: false,
			createdAt: new Date('2026-05-01T00:00:00Z'),
			updatedAt: new Date('2026-05-02T00:00:00Z')
		});
		expect('history' in v4).toBe(false);
	});

	it('is idempotent for an already-V4 document', () => {
		const sourceBlob = new Blob(['reference'], { type: 'image/png' });
		const referenceLayer: ReferenceLayerRecord = {
			kind: 'reference',
			id: crypto.randomUUID(),
			name: 'Reference',
			visible: true,
			opacity: 0.75,
			sourceBlob,
			naturalWidth: 24,
			naturalHeight: 16,
			placement: { x: 2, y: 3, scale: 1.5 }
		};
		const v4: DocumentSchemaV4 = {
			...migrateV3ToV4(makeV3()),
			layers: [referenceLayer]
		};

		expect(migrateV3ToV4(v4)).toBe(v4);
	});

	it('normalizes already-V4 Reference Layers to one bottom-most underlay', () => {
		const v4 = migrateV3ToV4(makeV3());
		const oldReference: ReferenceLayerRecord = {
			kind: 'reference',
			id: 'old-reference',
			name: 'Old reference',
			visible: true,
			opacity: 1,
			sourceBlob: new Blob(['old'], { type: 'image/png' }),
			naturalWidth: 1,
			naturalHeight: 1,
			placement: { x: 0, y: 0, scale: 1 }
		};
		const keptReference: ReferenceLayerRecord = {
			kind: 'reference',
			id: 'kept-reference',
			name: 'Kept reference',
			visible: false,
			opacity: 0.5,
			sourceBlob: new Blob(['kept'], { type: 'image/png' }),
			naturalWidth: 2,
			naturalHeight: 1,
			placement: { x: 3, y: 4, scale: 2 }
		};
		const mixed: DocumentSchemaV4 = {
			...v4,
			layers: [v4.layers[0], oldReference, v4.layers[1], keptReference],
			activeLayerId: oldReference.id
		};

		const normalized = migrateV3ToV4(mixed);

		expect(normalized.layers).toHaveLength(3);
		expect(normalized.layers[0]).toBe(keptReference);
		expect(normalized.layers.map((layer) => layer.kind)).toEqual(['reference', 'pixel', 'pixel']);
		expect(normalized.activeLayerId).toBe(keptReference.id);
	});

	it('rejects a V3 document with no layers', () => {
		const empty = makeV3({ layers: [] });

		expect(() => migrateV3ToV4(empty)).toThrow('Cannot migrate a V3 document with no layers');
	});
});
