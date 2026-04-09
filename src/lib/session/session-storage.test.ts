import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionStorage } from './session-storage';
import { migrateDocumentToV2 } from './session-storage-types';
import type { DocumentRecord, DocumentSchemaV1, WorkspaceRecord } from './session-storage-types';

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
			const doc: DocumentRecord = {
				schemaVersion: 2,
				id: 'doc-del',
				name: 'To delete',
				width: 1,
				height: 1,
				pixels: new Uint8Array([0, 0, 0, 255]),
				saved: false,
				createdAt: new Date(),
				updatedAt: new Date()
			};
			await storage.putDocument(doc);

			await storage.deleteDocument('doc-del');
			const result = await storage.getDocument('doc-del');

			expect(result).toBeUndefined();
		});

		it('stores and retrieves a document with pixel data', async () => {
			const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);
			const doc: DocumentRecord = {
				schemaVersion: 2,
				id: 'doc-1',
				name: 'Untitled 1',
				width: 2,
				height: 1,
				pixels,
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
			expect(retrieved!.pixels).toEqual(pixels);
			expect(retrieved!.createdAt).toEqual(new Date('2026-04-06T00:00:00Z'));
		});

		it('round-trips saved and schemaVersion fields', async () => {
			const doc: DocumentRecord = {
				schemaVersion: 2,
				id: 'doc-v2',
				name: 'Versioned',
				width: 1,
				height: 1,
				pixels: new Uint8Array([0, 0, 0, 255]),
				saved: true,
				createdAt: new Date(),
				updatedAt: new Date()
			};
			await storage.putDocument(doc);
			const retrieved = await storage.getDocument('doc-v2');

			expect(retrieved).toBeDefined();
			expect(retrieved!.schemaVersion).toBe(2);
			expect(retrieved!.saved).toBe(true);
		});

		it('normalizes a V1 document on read', async () => {
			// Write a V1-shaped document directly (no schemaVersion, no saved)
			const rawDb = await openDB('dotorixel', 2);
			await rawDb.put('documents', {
				id: 'doc-v1',
				name: 'Old doc',
				width: 4,
				height: 4,
				pixels: new Uint8Array(4 * 4 * 4),
				createdAt: new Date('2026-01-01'),
				updatedAt: new Date('2026-01-01')
			});
			rawDb.close();

			const retrieved = await storage.getDocument('doc-v1');

			expect(retrieved).toBeDefined();
			expect(retrieved!.schemaVersion).toBe(2);
			expect(retrieved!.saved).toBe(true);
			expect(retrieved!.name).toBe('Old doc');
		});
	});

	describe('schema migration', () => {
		it('upgrades V1 documents to V2 on DB open', async () => {
			// Close the V2 DB opened by beforeEach
			storage.close();
			indexedDB.deleteDatabase('dotorixel');

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

			// Re-open with SessionStorage — triggers V1→V2 migration
			storage = await SessionStorage.open();
			const doc = await storage.getDocument('old-doc');

			expect(doc).toBeDefined();
			expect(doc!.schemaVersion).toBe(2);
			expect(doc!.saved).toBe(true);
			expect(doc!.name).toBe('Pre-migration');
			expect(doc!.createdAt).toEqual(new Date('2026-02-01'));
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
