import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionStorage } from './session-storage';
import type { DocumentRecord, WorkspaceRecord } from './session-storage-types';

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

		it('stores and retrieves the saved field', async () => {
			const doc: DocumentRecord = {
				schemaVersion: 2,
				id: 'doc-saved',
				name: 'Saved doc',
				width: 1,
				height: 1,
				pixels: new Uint8Array([0, 0, 0, 255]),
				saved: true,
				createdAt: new Date(),
				updatedAt: new Date()
			};
			await storage.putDocument(doc);
			const retrieved = await storage.getDocument('doc-saved');

			expect(retrieved).toBeDefined();
			expect(retrieved!.saved).toBe(true);
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
