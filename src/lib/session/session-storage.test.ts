import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionStorage } from './session-storage';
import { migrateDocumentToV2, migrateV2ToV3 } from './session-storage-types';
import type {
	DocumentRecord,
	DocumentSchemaV1,
	DocumentSchemaV2,
	DocumentSchemaV3,
	WorkspaceRecord
} from './session-storage-types';

function makeSingleLayerV3(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
	const layerId = crypto.randomUUID();
	return {
		schemaVersion: 3,
		id: 'doc-1',
		name: 'Untitled 1',
		width: 1,
		height: 1,
		layers: [
			{
				id: layerId,
				name: 'Layer 1',
				pixels: new Uint8Array([0, 0, 0, 255]),
				visible: true,
				opacity: 1
			}
		],
		activeLayerId: layerId,
		nextLayerNumber: 2,
		timelinePanelCollapsed: false,
		saved: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	};
}

describe('SessionStorage', () => {
	let storage: SessionStorage;

	beforeEach(async () => {
		storage = await SessionStorage.open();
	});

	afterEach(() => {
		storage.close();
		indexedDB.deleteDatabase('dotorixel');
	});

	describe('document CRUD', () => {
		it('returns undefined for a non-existent document', async () => {
			const result = await storage.getDocument('non-existent');

			expect(result).toBeUndefined();
		});

		it('deletes a document', async () => {
			const doc = makeSingleLayerV3({ id: 'doc-del', name: 'To delete' });
			await storage.putDocument(doc);

			await storage.deleteDocument('doc-del');
			const result = await storage.getDocument('doc-del');

			expect(result).toBeUndefined();
		});

		it('stores and retrieves a document with pixel data', async () => {
			const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);
			const layerId = crypto.randomUUID();
			const doc: DocumentRecord = {
				schemaVersion: 3,
				id: 'doc-1',
				name: 'Untitled 1',
				width: 2,
				height: 1,
				layers: [
					{ id: layerId, name: 'Layer 1', pixels, visible: true, opacity: 1 }
				],
				activeLayerId: layerId,
				nextLayerNumber: 2,
				timelinePanelCollapsed: false,
				saved: false,
				createdAt: new Date('2026-04-06T00:00:00Z'),
				updatedAt: new Date('2026-04-06T00:00:00Z')
			};

			await storage.putDocument(doc);
			const retrieved = await storage.getDocument('doc-1');

			expect(retrieved).toBeDefined();
			expect(retrieved!.id).toBe('doc-1');
			expect(retrieved!.name).toBe('Untitled 1');
			expect(retrieved!.width).toBe(2);
			expect(retrieved!.height).toBe(1);
			expect(retrieved!.layers[0].pixels).toEqual(pixels);
			expect(retrieved!.createdAt).toEqual(new Date('2026-04-06T00:00:00Z'));
		});

		it('round-trips saved and schemaVersion fields', async () => {
			const doc = makeSingleLayerV3({ id: 'doc-v3', name: 'Versioned', saved: true });
			await storage.putDocument(doc);
			const retrieved = await storage.getDocument('doc-v3');

			expect(retrieved).toBeDefined();
			expect(retrieved!.schemaVersion).toBe(3);
			expect(retrieved!.saved).toBe(true);
		});

		it('normalizes a V1 document on read', async () => {
			// Write a V1-shaped document directly (no schemaVersion, no saved)
			const v1Pixels = new Uint8Array(4 * 4 * 4);
			v1Pixels[0] = 200; // distinctive signature
			v1Pixels[3] = 255;
			const rawDb = await openDB('dotorixel', 3);
			await rawDb.put('documents', {
				id: 'doc-v1',
				name: 'Old doc',
				width: 4,
				height: 4,
				pixels: v1Pixels,
				createdAt: new Date('2026-01-01'),
				updatedAt: new Date('2026-01-01')
			});
			rawDb.close();

			const retrieved = await storage.getDocument('doc-v1');

			expect(retrieved).toBeDefined();
			expect(retrieved!.schemaVersion).toBe(3);
			expect(retrieved!.saved).toBe(true);
			expect(retrieved!.name).toBe('Old doc');
			expect(retrieved!.layers).toHaveLength(1);
			expect(retrieved!.layers[0].name).toBe('Layer 1');
			expect(retrieved!.layers[0].pixels).toEqual(v1Pixels);
			expect(retrieved!.layers[0].visible).toBe(true);
			expect(retrieved!.layers[0].opacity).toBe(1);
			expect(retrieved!.activeLayerId).toBe(retrieved!.layers[0].id);
			expect(retrieved!.nextLayerNumber).toBe(2);
			expect(retrieved!.timelinePanelCollapsed).toBe(false);
		});
	});

	describe('V3 document CRUD', () => {
		it('round-trips a multi-layer V3 document preserving order, metadata, and active pointer', async () => {
			const bottomId = crypto.randomUUID();
			const middleId = crypto.randomUUID();
			const topId = crypto.randomUUID();
			const bottomPixels = new Uint8Array(2 * 2 * 4);
			bottomPixels[0] = 255;
			bottomPixels[3] = 255;
			const middlePixels = new Uint8Array(2 * 2 * 4);
			middlePixels[5] = 200;
			middlePixels[7] = 255;
			const topPixels = new Uint8Array(2 * 2 * 4);
			topPixels[10] = 50;
			topPixels[11] = 255;

			const doc: DocumentSchemaV3 = {
				schemaVersion: 3,
				id: 'doc-multi',
				name: 'Multi-layer',
				width: 2,
				height: 2,
				layers: [
					{ id: bottomId, name: 'Bottom', pixels: bottomPixels, visible: true, opacity: 1 },
					{ id: middleId, name: 'Middle', pixels: middlePixels, visible: false, opacity: 0.5 },
					{ id: topId, name: 'Top', pixels: topPixels, visible: true, opacity: 0.75 }
				],
				activeLayerId: middleId,
				nextLayerNumber: 4,
				timelinePanelCollapsed: true,
				saved: true,
				createdAt: new Date('2026-05-02T00:00:00Z'),
				updatedAt: new Date('2026-05-02T00:00:00Z')
			};

			await storage.putDocument(doc);
			const retrieved = await storage.getDocument('doc-multi');

			expect(retrieved).toBeDefined();
			expect(retrieved!.layers).toHaveLength(3);
			expect(retrieved!.layers.map((l) => l.id)).toEqual([bottomId, middleId, topId]);
			expect(retrieved!.layers.map((l) => l.name)).toEqual(['Bottom', 'Middle', 'Top']);
			expect(retrieved!.layers.map((l) => l.visible)).toEqual([true, false, true]);
			expect(retrieved!.layers.map((l) => l.opacity)).toEqual([1, 0.5, 0.75]);
			expect(retrieved!.layers[0].pixels).toEqual(bottomPixels);
			expect(retrieved!.layers[1].pixels).toEqual(middlePixels);
			expect(retrieved!.layers[2].pixels).toEqual(topPixels);
			expect(retrieved!.activeLayerId).toBe(middleId);
			expect(retrieved!.nextLayerNumber).toBe(4);
			expect(retrieved!.timelinePanelCollapsed).toBe(true);
		});

		it('round-trips a single-layer V3 document with multi-layer fields intact', async () => {
			const layerId = crypto.randomUUID();
			const pixels = new Uint8Array(2 * 2 * 4);
			pixels[0] = 255;
			pixels[3] = 255;
			const doc: DocumentSchemaV3 = {
				schemaVersion: 3,
				id: 'doc-v3',
				name: 'V3 doc',
				width: 2,
				height: 2,
				layers: [
					{ id: layerId, name: 'Layer 1', pixels, visible: true, opacity: 1 }
				],
				activeLayerId: layerId,
				nextLayerNumber: 2,
				timelinePanelCollapsed: false,
				saved: false,
				createdAt: new Date('2026-05-01T00:00:00Z'),
				updatedAt: new Date('2026-05-01T00:00:00Z')
			};

			await storage.putDocument(doc);
			const retrieved = await storage.getDocument('doc-v3');

			expect(retrieved).toBeDefined();
			expect(retrieved!.schemaVersion).toBe(3);
			expect(retrieved!.id).toBe('doc-v3');
			expect(retrieved!.width).toBe(2);
			expect(retrieved!.height).toBe(2);
			expect(retrieved!.layers).toHaveLength(1);
			expect(retrieved!.layers[0].id).toBe(layerId);
			expect(retrieved!.layers[0].name).toBe('Layer 1');
			expect(retrieved!.layers[0].pixels).toEqual(pixels);
			expect(retrieved!.layers[0].visible).toBe(true);
			expect(retrieved!.layers[0].opacity).toBe(1);
			expect(retrieved!.activeLayerId).toBe(layerId);
			expect(retrieved!.nextLayerNumber).toBe(2);
			expect(retrieved!.timelinePanelCollapsed).toBe(false);
		});
	});

	describe('schema migration', () => {
		it('upgrades V1 documents to V2 on DB open', async () => {
			// Close the V2 DB opened by beforeEach
			storage.close();
			await new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase('dotorixel');
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});

			// Create a V1 database with a document
			const v1Db = await openDB('dotorixel', 1, {
				upgrade(db) {
					const store = db.createObjectStore('documents', { keyPath: 'id' });
					store.createIndex('updatedAt', 'updatedAt');
					db.createObjectStore('workspace', { keyPath: 'id' });
				}
			});
			await v1Db.put('documents', {
				id: 'old-doc',
				name: 'Pre-migration',
				width: 16,
				height: 16,
				pixels: new Uint8Array(16 * 16 * 4),
				createdAt: new Date('2026-02-01'),
				updatedAt: new Date('2026-02-15')
			});
			v1Db.close();

			// Re-open with SessionStorage — triggers V1→V3 migration
			storage = await SessionStorage.open();

			// Verify migration wrote to the raw store (not just read-time normalization)
			const rawDb = await openDB('dotorixel', 3);
			const stored = await rawDb.get('documents', 'old-doc');
			rawDb.close();

			expect(stored).toBeDefined();
			expect(stored).toMatchObject({
				id: 'old-doc',
				name: 'Pre-migration',
				schemaVersion: 3,
				saved: true
			});
			expect(stored!.createdAt).toEqual(new Date('2026-02-01'));
		});

		it('upgrades V2 documents to V3 on DB open', async () => {
			// Close the V3 DB opened by beforeEach
			storage.close();
			await new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase('dotorixel');
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});

			// Create a V2 database with a V2 document
			const v2Pixels = new Uint8Array(8 * 8 * 4);
			v2Pixels[0] = 123;
			v2Pixels[3] = 255;
			const v2Db = await openDB('dotorixel', 2, {
				upgrade(db) {
					const store = db.createObjectStore('documents', { keyPath: 'id' });
					store.createIndex('updatedAt', 'updatedAt');
					db.createObjectStore('workspace', { keyPath: 'id' });
				}
			});
			await v2Db.put('documents', {
				schemaVersion: 2,
				id: 'v2-doc',
				name: 'V2 saved',
				width: 8,
				height: 8,
				pixels: v2Pixels,
				saved: true,
				createdAt: new Date('2026-03-01'),
				updatedAt: new Date('2026-03-10')
			});
			v2Db.close();

			// Re-open with SessionStorage — triggers V2→V3 migration
			storage = await SessionStorage.open();

			// Verify the raw store now holds a V3 record
			const rawDb = await openDB('dotorixel', 3);
			const stored = await rawDb.get('documents', 'v2-doc');
			rawDb.close();

			expect(stored).toBeDefined();
			expect(stored!.schemaVersion).toBe(3);
			expect(stored!.name).toBe('V2 saved');
			expect(stored!.saved).toBe(true);
			// V2 pixels rewrapped as a single Layer 1
			expect(stored!.layers).toHaveLength(1);
			expect(stored!.layers[0].name).toBe('Layer 1');
			expect(stored!.layers[0].pixels).toEqual(v2Pixels);
			expect(stored!.activeLayerId).toBe(stored!.layers[0].id);
			expect(stored!.nextLayerNumber).toBe(2);
			expect(stored!.timelinePanelCollapsed).toBe(false);
		});
	});

	describe('getAllSavedDocuments', () => {
		it('returns only saved documents, sorted by updatedAt descending', async () => {
			const savedOldPixels = new Uint8Array(8 * 8 * 4);
			const savedNewPixels = new Uint8Array(16 * 16 * 4);
			const savedOld = makeSingleLayerV3({
				id: 'saved-old',
				name: 'Old saved',
				width: 8,
				height: 8,
				layers: [
					{
						id: crypto.randomUUID(),
						name: 'Layer 1',
						pixels: savedOldPixels,
						visible: true,
						opacity: 1
					}
				],
				saved: true,
				createdAt: new Date('2026-04-01'),
				updatedAt: new Date('2026-04-01')
			});
			const savedNew = makeSingleLayerV3({
				id: 'saved-new',
				name: 'New saved',
				width: 16,
				height: 16,
				layers: [
					{
						id: crypto.randomUUID(),
						name: 'Layer 1',
						pixels: savedNewPixels,
						visible: true,
						opacity: 1
					}
				],
				saved: true,
				createdAt: new Date('2026-04-05'),
				updatedAt: new Date('2026-04-05')
			});
			const unsaved = makeSingleLayerV3({
				id: 'unsaved',
				name: 'Untitled 1',
				width: 4,
				height: 4,
				layers: [
					{
						id: crypto.randomUUID(),
						name: 'Layer 1',
						pixels: new Uint8Array(4 * 4 * 4),
						visible: true,
						opacity: 1
					}
				],
				saved: false,
				createdAt: new Date('2026-04-03'),
				updatedAt: new Date('2026-04-03')
			});

			await storage.putDocument(savedOld);
			await storage.putDocument(unsaved);
			await storage.putDocument(savedNew);

			const result = await storage.getAllSavedDocuments();

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe('saved-new');
			expect(result[1].id).toBe('saved-old');
			expect(result[0]).toEqual({
				id: 'saved-new',
				name: 'New saved',
				width: 16,
				height: 16,
				pixels: savedNewPixels,
				updatedAt: new Date('2026-04-05')
			});
		});

		it('returns the composite of visible layers as the thumbnail for a multi-layer V3 doc', async () => {
			// 1x1 doc with two layers:
			//   bottom (red, opaque, visible) + top (blue, half-opaque, visible)
			//   expected composite at (0,0): top 50% over red → mix
			const bottomId = crypto.randomUUID();
			const topId = crypto.randomUUID();
			const bottomPixels = new Uint8Array([255, 0, 0, 255]);
			const topPixels = new Uint8Array([0, 0, 255, 255]);
			const doc: DocumentRecord = {
				schemaVersion: 3,
				id: 'multi-saved',
				name: 'Multi saved',
				width: 1,
				height: 1,
				layers: [
					{ id: bottomId, name: 'Bottom', pixels: bottomPixels, visible: true, opacity: 1 },
					{ id: topId, name: 'Top', pixels: topPixels, visible: true, opacity: 0.5 }
				],
				activeLayerId: topId,
				nextLayerNumber: 3,
				timelinePanelCollapsed: false,
				saved: true,
				createdAt: new Date('2026-05-03'),
				updatedAt: new Date('2026-05-03')
			};
			await storage.putDocument(doc);

			const summaries = await storage.getAllSavedDocuments();

			expect(summaries).toHaveLength(1);
			// source-over with top.opacity=0.5 over red:
			//   src_alpha = 255 * 0.5 = 127.5 → 128 (rounded)
			//   out_R = 0 * 128/255 + 255 * (1 - 128/255) ≈ 127
			//   out_B = 255 * 128/255 + 0 ≈ 128
			const [r, g, b, a] = summaries[0].pixels;
			expect(r).toBeGreaterThan(100);
			expect(r).toBeLessThan(140);
			expect(g).toBe(0);
			expect(b).toBeGreaterThan(100);
			expect(b).toBeLessThan(140);
			expect(a).toBe(255);
		});

		it('skips hidden layers when building the thumbnail', async () => {
			const bottomId = crypto.randomUUID();
			const topId = crypto.randomUUID();
			const bottomPixels = new Uint8Array([255, 0, 0, 255]);
			const topPixels = new Uint8Array([0, 0, 255, 255]); // would overwrite if visible
			const doc: DocumentRecord = {
				schemaVersion: 3,
				id: 'hidden-top',
				name: 'Hidden top',
				width: 1,
				height: 1,
				layers: [
					{ id: bottomId, name: 'Bottom', pixels: bottomPixels, visible: true, opacity: 1 },
					{ id: topId, name: 'Top', pixels: topPixels, visible: false, opacity: 1 }
				],
				activeLayerId: bottomId,
				nextLayerNumber: 3,
				timelinePanelCollapsed: false,
				saved: true,
				createdAt: new Date('2026-05-03'),
				updatedAt: new Date('2026-05-03')
			};
			await storage.putDocument(doc);

			const summaries = await storage.getAllSavedDocuments();

			expect(summaries[0].pixels).toEqual(bottomPixels);
		});

		it('returns empty array when no saved documents exist', async () => {
			const unsaved = makeSingleLayerV3({
				id: 'unsaved',
				name: 'Untitled 1',
				width: 4,
				height: 4,
				saved: false
			});
			await storage.putDocument(unsaved);

			const result = await storage.getAllSavedDocuments();

			expect(result).toEqual([]);
		});
	});

	describe('workspace CRUD', () => {
		it('returns undefined for a non-existent workspace', async () => {
			const result = await storage.getWorkspace();

			expect(result).toBeUndefined();
		});

		it('stores and retrieves workspace metadata', async () => {
			const ws: WorkspaceRecord = {
				id: 'current',
				tabOrder: ['doc-1'],
				activeTabIndex: 0,
				sharedState: {
					activeTool: 'line',
					foregroundColor: { r: 255, g: 0, b: 0, a: 255 },
					backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
					recentColors: ['#ff0000', '#00ff00']
				},
				viewports: {
					'doc-1': {
						pixelSize: 32,
						zoom: 2.5,
						panX: 100,
						panY: -50,
						showGrid: false,
						gridColor: '#ECE5D9'
					}
				}
			};

			await storage.putWorkspace(ws);
			const retrieved = await storage.getWorkspace();

			expect(retrieved).toBeDefined();
			expect(retrieved!.tabOrder).toEqual(['doc-1']);
			expect(retrieved!.activeTabIndex).toBe(0);
			expect(retrieved!.sharedState.activeTool).toBe('line');
			expect(retrieved!.sharedState.foregroundColor).toEqual({ r: 255, g: 0, b: 0, a: 255 });
			expect(retrieved!.sharedState.recentColors).toEqual(['#ff0000', '#00ff00']);
			expect(retrieved!.viewports['doc-1'].zoom).toBe(2.5);
			expect(retrieved!.viewports['doc-1'].panX).toBe(100);
			expect(retrieved!.viewports['doc-1'].showGrid).toBe(false);
		});
	});
});

describe('migrateDocumentToV2', () => {
	it('adds schemaVersion and saved to a V1 document', () => {
		const v1: DocumentSchemaV1 = {
			id: 'doc-1',
			name: 'Test',
			width: 8,
			height: 8,
			pixels: new Uint8Array(8 * 8 * 4),
			createdAt: new Date('2026-03-01'),
			updatedAt: new Date('2026-03-15')
		};

		const v2 = migrateDocumentToV2(v1);

		expect(v2.schemaVersion).toBe(2);
		expect(v2.saved).toBe(true);
		expect(v2.id).toBe('doc-1');
		expect(v2.name).toBe('Test');
		expect(v2.createdAt).toEqual(new Date('2026-03-01'));
		expect(v2.updatedAt).toEqual(new Date('2026-03-15'));
	});
});

describe('migrateV2ToV3', () => {
	const sampleV2 = (): DocumentSchemaV2 => {
		const pixels = new Uint8Array(4 * 4 * 4);
		// paint a non-trivial signature so a faulty wrap can be detected
		for (let i = 0; i < pixels.length; i += 4) {
			pixels[i] = (i / 4) & 0xff;
			pixels[i + 3] = 255;
		}
		return {
			schemaVersion: 2,
			id: 'doc-v2',
			name: 'Migrated',
			width: 4,
			height: 4,
			pixels,
			createdAt: new Date('2026-04-01'),
			updatedAt: new Date('2026-04-10'),
			saved: true
		};
	};

	it('wraps the V2 pixel buffer into a single "Layer 1" with schemaVersion 3', () => {
		const v2 = sampleV2();

		const v3 = migrateV2ToV3(v2);

		expect(v3.schemaVersion).toBe(3);
		expect(v3.layers).toHaveLength(1);
		expect(v3.layers[0].name).toBe('Layer 1');
		expect(v3.layers[0].pixels).toEqual(v2.pixels);
	});

	it('preserves dimensions and seeds Document-level counters', () => {
		const v2: DocumentSchemaV2 = { ...sampleV2(), width: 32, height: 24 };

		const v3 = migrateV2ToV3(v2);

		expect(v3.width).toBe(32);
		expect(v3.height).toBe(24);
		expect(v3.nextLayerNumber).toBe(2);
		expect(v3.timelinePanelCollapsed).toBe(false);
	});

	it('points activeLayerId at the wrapped layer using a fresh UUID v4', () => {
		const v3 = migrateV2ToV3(sampleV2());

		expect(v3.activeLayerId).toBe(v3.layers[0].id);
		expect(v3.activeLayerId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		);
	});

	it('initializes the wrapped layer as visible with full opacity', () => {
		const v3 = migrateV2ToV3(sampleV2());

		expect(v3.layers[0].visible).toBe(true);
		expect(v3.layers[0].opacity).toBe(1);
	});

	it('detaches the V3 pixel buffer from the V2 source so writes do not alias', () => {
		const v2 = sampleV2();

		const v3 = migrateV2ToV3(v2);
		v3.layers[0].pixels[0] = 0xff;
		v3.layers[0].pixels[1] = 0xff;

		expect(v2.pixels[0]).toBe(0);
		expect(v2.pixels[1]).toBe(0);
	});

	it('preserves top-level document metadata (id, name, saved, timestamps)', () => {
		const v2: DocumentSchemaV2 = {
			...sampleV2(),
			id: 'doc-keep',
			name: 'Keep Me',
			saved: false,
			createdAt: new Date('2025-12-01'),
			updatedAt: new Date('2026-04-15')
		};

		const v3 = migrateV2ToV3(v2);

		expect(v3.id).toBe('doc-keep');
		expect(v3.name).toBe('Keep Me');
		expect(v3.saved).toBe(false);
		expect(v3.createdAt).toEqual(new Date('2025-12-01'));
		expect(v3.updatedAt).toEqual(new Date('2026-04-15'));
	});
});
