import { describe, expect, it } from 'vitest';
import {
	compositeForExportSummary,
	migrateV3ToV4,
	migrateV4ToV5,
	migrateV5ToV6
} from './session-storage-types';
import type {
	DocumentSchemaV3,
	DocumentSchemaV4,
	DocumentSchemaV5,
	DocumentSchemaV6,
	PixelLayerRecord,
	PixelLayerRecordV6,
	ReferenceLayerRecord
} from './session-storage-types';

function makeV6(overrides: Partial<DocumentSchemaV6> = {}): DocumentSchemaV6 {
	return { ...migrateV5ToV6(makeV5()), ...overrides };
}

function makeV5(overrides: Partial<DocumentSchemaV5> = {}): DocumentSchemaV5 {
	return { ...migrateV4ToV5(migrateV3ToV4(makeV3())), ...overrides };
}

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
		expect(normalized.layers[1]).toBe(v4.layers[0]);
		expect(normalized.layers[2]).toBe(v4.layers[1]);
		expect(normalized.layers.map((layer) => layer.kind)).toEqual(['reference', 'pixel', 'pixel']);
		expect(normalized.activeLayerId).toBe(keptReference.id);
	});

	it('rejects a V3 document with no layers', () => {
		const empty = makeV3({ layers: [] });

		expect(() => migrateV3ToV4(empty)).toThrow('Cannot migrate a V3 document with no layers');
	});
});

describe('migrateV4ToV5', () => {
	it('adds a null Marquee to legacy V4 documents', () => {
		const v4 = migrateV3ToV4(makeV3());

		const v5 = migrateV4ToV5(v4);

		expect(v5.schemaVersion).toBe(5);
		expect(v5.marquee).toBeNull();
		expect(v5.layers).toEqual(v4.layers);
		expect(v5.activeLayerId).toBe(v4.activeLayerId);
	});

	it('preserves a Marquee when input is already V5', () => {
		const v4 = migrateV3ToV4(makeV3());
		const marquee = { x: 1, y: 2, width: 3, height: 4 };
		const seeded: DocumentSchemaV5 = { ...migrateV4ToV5(v4), marquee };

		const v5 = migrateV4ToV5(seeded);

		expect(v5.schemaVersion).toBe(5);
		expect(v5.marquee).toEqual(marquee);
		expect(v5.marquee).not.toBe(marquee);
		expect(v5.layers).toEqual(seeded.layers);
		expect(v5.activeLayerId).toBe(seeded.activeLayerId);
	});
});

describe('migrateV5ToV6', () => {
	it('synthesizes one frame whose single cel carries each pixel layer’s pixels', () => {
		const v5 = makeV5();

		const v6 = migrateV5ToV6(v5);

		expect(v6.schemaVersion).toBe(6);
		expect(v6.frames).toHaveLength(1);
		expect(v6.activeFrameId).toBe(v6.frames[0].id);

		const frameId = v6.frames[0].id;
		const pixelLayers = v6.layers.filter(
			(layer): layer is PixelLayerRecordV6 => layer.kind === 'pixel'
		);
		expect(pixelLayers).toHaveLength(2);
		pixelLayers.forEach((layer, index) => {
			expect(layer.cels).toHaveLength(1);
			expect(layer.cels[0].frameId).toBe(frameId);
			expect(layer.cels[0].pixels).toEqual(
				(v5.layers[index] as PixelLayerRecord).pixels
			);
			// Copy, not alias — a Cel must not share the V5 layer's buffer.
			expect(layer.cels[0].pixels).not.toBe(
				(v5.layers[index] as PixelLayerRecord).pixels
			);
		});
	});

	it('carries the frame-independent Reference Layer through unchanged', () => {
		const reference: ReferenceLayerRecord = {
			kind: 'reference',
			id: crypto.randomUUID(),
			name: 'Reference',
			visible: true,
			opacity: 0.75,
			sourceBlob: new Blob(['reference'], { type: 'image/png' }),
			naturalWidth: 24,
			naturalHeight: 16,
			placement: { x: 2, y: 3, scale: 1.5, rotation: 1 }
		};
		const v5 = makeV5({ layers: [reference, ...migrateV3ToV4(makeV3()).layers] });

		const v6 = migrateV5ToV6(v5);

		expect(v6.layers[0]).toEqual(reference);
		expect('cels' in v6.layers[0]).toBe(false);
	});

	it('preserves document metadata while resetting the layer pixels into cels', () => {
		const v5 = makeV5({
			id: 'doc-v5',
			name: 'V5 document',
			width: 64,
			height: 32,
			activeLayerId: 'active-layer',
			nextLayerNumber: 9,
			timelinePanelCollapsed: true,
			marquee: { x: 1, y: 2, width: 3, height: 4 },
			saved: true,
			createdAt: new Date('2026-06-01T00:00:00Z'),
			updatedAt: new Date('2026-06-02T00:00:00Z')
		});

		const v6 = migrateV5ToV6(v5);

		expect(v6).toMatchObject({
			id: 'doc-v5',
			name: 'V5 document',
			width: 64,
			height: 32,
			activeLayerId: 'active-layer',
			nextLayerNumber: 9,
			timelinePanelCollapsed: true,
			marquee: { x: 1, y: 2, width: 3, height: 4 },
			saved: true,
			createdAt: new Date('2026-06-01T00:00:00Z'),
			updatedAt: new Date('2026-06-02T00:00:00Z')
		});
		expect('nextFrameNumber' in v6).toBe(false);
	});
});

describe('compositeForExportSummary', () => {
	it('composites the active frame’s cels for a V6 document', () => {
		const frameA = crypto.randomUUID();
		const frameB = crypto.randomUUID();
		const red = new Uint8Array([255, 0, 0, 255]);
		const blue = new Uint8Array([0, 0, 255, 255]);
		const v6: DocumentSchemaV6 = makeV6({
			width: 1,
			height: 1,
			frames: [{ id: frameA }, { id: frameB }],
			activeFrameId: frameB,
			layers: [
				{
					kind: 'pixel',
					id: 'layer-1',
					name: 'Layer 1',
					cels: [
						{ frameId: frameA, pixels: red },
						{ frameId: frameB, pixels: blue }
					],
					visible: true,
					opacity: 1
				}
			]
		});

		expect(compositeForExportSummary(v6)).toEqual(blue);
	});
});
