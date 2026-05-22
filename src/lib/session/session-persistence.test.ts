// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { WorkspaceSnapshot, TabSnapshot } from '$lib/canvas/workspace-snapshot';
import type { ReferenceImage } from '$lib/reference-images/reference-image-types';
import type { DisplayState } from '$lib/reference-images/display-state-types';
import { decodeReferenceBlob } from '$lib/reference-images/decode-reference-blob';
import {
	tabSnapshotFixture,
	type TabSnapshotFixtureOpts
} from '$lib/canvas/workspace-snapshot-fixtures';
import { Workspace } from '$lib/canvas/editor-session/workspace.svelte';
import { wasmBackend } from '$lib/canvas/wasm-backend';
import { createFakeDirtyNotifier } from '$lib/canvas/editor-session/fake-dirty-notifier';
import { SessionPersistence } from './session-persistence';
import { SessionStorage } from './session-storage';
import type { DocumentRecord } from './session-storage-types';

vi.mock('$lib/reference-images/decode-reference-blob', () => ({
	decodeReferenceBlob: vi.fn()
}));

function makeRef(id: string): ReferenceImage {
	return {
		id,
		filename: `${id}.png`,
		blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
		thumbnail: new Blob([new Uint8Array([4, 5, 6])], { type: 'image/png' }),
		mimeType: 'image/png',
		naturalWidth: 100,
		naturalHeight: 100,
		byteSize: 3,
		addedAt: new Date('2026-04-26T00:00:00Z')
	};
}

function makeTab(overrides: TabSnapshotFixtureOpts = {}): TabSnapshot {
	return tabSnapshotFixture({ name: 'Untitled 1', width: 16, height: 16, ...overrides });
}

function expectPixelLayer(layer: TabSnapshot['layers'][number]) {
	expect(layer.kind).toBe('pixel');
	if (layer.kind !== 'pixel') throw new Error('Expected Pixel Layer');
	return layer;
}

function expectReferenceLayer(layer: TabSnapshot['layers'][number]) {
	expect(layer.kind).toBe('reference');
	if (layer.kind !== 'reference') throw new Error('Expected Reference Layer');
	return layer;
}

function makeSnapshot(
	overrides: Partial<WorkspaceSnapshot> = {},
	tabs?: readonly TabSnapshot[]
): WorkspaceSnapshot {
	return {
		tabs: tabs ?? [makeTab()],
		activeTabIndex: 0,
		sharedState: {
			activeTool: 'pencil',
			foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
			backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
			recentColors: []
		},
		...overrides
	};
}

describe('SessionPersistence', () => {
	let storage: SessionStorage;
	let persistence: SessionPersistence;

	beforeEach(async () => {
		vi.mocked(decodeReferenceBlob).mockReset();
		storage = await SessionStorage.open();
		persistence = new SessionPersistence(storage);
	});

	afterEach(() => {
		storage.close();
		indexedDB.deleteDatabase('dotorixel');
	});

	it('round-trips a single-tab workspace through save and restore', async () => {
		const redPixels = new Uint8Array(16 * 16 * 4);
		redPixels[0] = 255; redPixels[3] = 255; // red pixel at (0,0)

		const snapshot = makeSnapshot({
			sharedState: {
				activeTool: 'line',
				foregroundColor: { r: 200, g: 50, b: 30, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			}
		}, [makeTab({ pixels: redPixels })]);

		await persistence.save(snapshot);
		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(restored!.tabs).toHaveLength(1);
		expect(restored!.tabs[0].name).toBe('Untitled 1');
		expect(restored!.tabs[0].width).toBe(16);
		expect(restored!.tabs[0].height).toBe(16);
		// Verify pixel data includes the red pixel
		const restoredPixels = expectPixelLayer(restored!.tabs[0].layers[0]).pixels;
		expect(restoredPixels[0]).toBe(255); // R
		expect(restoredPixels[1]).toBe(0);   // G
		expect(restoredPixels[2]).toBe(0);   // B
		expect(restoredPixels[3]).toBe(255); // A
		// Verify shared state
		expect(restored!.sharedState.activeTool).toBe('line');
		expect(restored!.sharedState.foregroundColor).toEqual({ r: 200, g: 50, b: 30, a: 255 });
		expect(restored!.activeTabIndex).toBe(0);
	});

	it('round-trips every layer (id, name, pixels, visibility, opacity) and document state', async () => {
		const bottomId = crypto.randomUUID();
		const topId = crypto.randomUUID();
		const bottomPixels = new Uint8Array(2 * 2 * 4);
		// Mark bottom layer with a recognizable red pixel at index 0
		bottomPixels[0] = 255;
		bottomPixels[3] = 255;
		const topPixels = new Uint8Array(2 * 2 * 4);
		// Mark top layer with a green pixel at index 1
		topPixels[4] = 0;
		topPixels[5] = 255;
		topPixels[7] = 200;

		const multiLayerTab: TabSnapshot = {
			id: 'doc-multi',
			name: 'Layered',
			width: 2,
			height: 2,
			layers: [
				{ kind: 'pixel', id: bottomId, name: 'Background', pixels: bottomPixels, visible: true, opacity: 1 },
				{ kind: 'pixel', id: topId, name: 'Sketch', pixels: topPixels, visible: false, opacity: 0.5 }
			],
			activeLayerId: topId,
			nextLayerNumber: 7,
			timelinePanelCollapsed: true,
			viewport: {
				pixelSize: 32, zoom: 1.0, panX: 0, panY: 0,
				showGrid: true, gridColor: '#cccccc'
			}
		};

		await persistence.save(makeSnapshot({}, [multiLayerTab]));
		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(restored!.tabs).toHaveLength(1);
		const tab = restored!.tabs[0];
		expect(tab.activeLayerId).toBe(topId);
		expect(tab.nextLayerNumber).toBe(7);
		expect(tab.timelinePanelCollapsed).toBe(true);
		expect(tab.layers).toHaveLength(2);

		const bottomLayer = expectPixelLayer(tab.layers[0]);
		expect(bottomLayer.id).toBe(bottomId);
		expect(bottomLayer.name).toBe('Background');
		expect(bottomLayer.visible).toBe(true);
		expect(bottomLayer.opacity).toBe(1);
		expect(Array.from(bottomLayer.pixels)).toEqual(Array.from(bottomPixels));

		const topLayer = expectPixelLayer(tab.layers[1]);
		expect(topLayer.id).toBe(topId);
		expect(topLayer.name).toBe('Sketch');
		expect(topLayer.visible).toBe(false);
		expect(topLayer.opacity).toBeCloseTo(0.5);
		expect(Array.from(topLayer.pixels)).toEqual(Array.from(topPixels));
	});

	it('restores Reference Layer records by decoding source blobs for document hydration', async () => {
		const pixelId = crypto.randomUUID();
		const referenceId = crypto.randomUUID();
		const sourceBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
		const sourceRgba = new Uint8ClampedArray([
			10, 20, 30, 255,
			40, 50, 60, 255
		]);
		vi.mocked(decodeReferenceBlob).mockResolvedValue({
			width: 2,
			height: 1,
			data: sourceRgba
		});
		const doc: DocumentRecord = {
			schemaVersion: 4,
			id: 'doc-reference',
			name: 'Reference doc',
			width: 2,
			height: 2,
			layers: [
				{
					kind: 'pixel',
					id: pixelId,
					name: 'Paint',
					pixels: new Uint8Array(2 * 2 * 4),
					visible: true,
					opacity: 1
				},
				{
					kind: 'reference',
					id: referenceId,
					name: 'Sketch.png',
					visible: false,
					opacity: 0.5,
					sourceBlob,
					naturalWidth: 2,
					naturalHeight: 1,
					placement: { x: 3, y: 4, scale: 2 }
				}
			],
			activeLayerId: referenceId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: true,
			saved: false,
			createdAt: new Date('2026-05-01T00:00:00Z'),
			updatedAt: new Date('2026-05-02T00:00:00Z')
		};
		await storage.putDocument(doc);
		await storage.putWorkspace({
			id: 'current',
			tabOrder: ['doc-reference'],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			},
			viewports: {}
		});

		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(decodeReferenceBlob).toHaveBeenCalledOnce();
		const restoredReference = expectReferenceLayer(restored!.tabs[0].layers[0]);
		expect(restoredReference.sourceBlob.type).toBe('image/png');
		expect(Array.from(restoredReference.sourceRgba)).toEqual(Array.from(sourceRgba));
		expect(restoredReference.naturalWidth).toBe(2);
		expect(restoredReference.naturalHeight).toBe(1);
		expect(restoredReference.placement).toEqual({ x: 3, y: 4, scale: 2 });
	});

	it('hydrates a Workspace with Reference Layers and can snapshot them back for persistence', async () => {
		const pixelId = crypto.randomUUID();
		const referenceId = crypto.randomUUID();
		const sourceBlob = new Blob([new Uint8Array([9, 8, 7])], { type: 'image/png' });
		const sourceRgba = new Uint8ClampedArray([
			90, 80, 70, 255,
			60, 50, 40, 255
		]);
		vi.mocked(decodeReferenceBlob).mockResolvedValue({
			width: 2,
			height: 1,
			data: sourceRgba
		});
		await storage.putDocument({
			schemaVersion: 4,
			id: 'doc-reference-workspace',
			name: 'Reference workspace',
			width: 2,
			height: 2,
			layers: [
				{
					kind: 'pixel',
					id: pixelId,
					name: 'Paint',
					pixels: new Uint8Array(2 * 2 * 4),
					visible: true,
					opacity: 1
				},
				{
					kind: 'reference',
					id: referenceId,
					name: 'Sketch.png',
					visible: true,
					opacity: 0.75,
					sourceBlob,
					naturalWidth: 2,
					naturalHeight: 1,
					placement: { x: 1, y: 2, scale: 3 }
				}
			],
			activeLayerId: referenceId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false,
			saved: false,
			createdAt: new Date('2026-05-01T00:00:00Z'),
			updatedAt: new Date('2026-05-02T00:00:00Z')
		});
		await storage.putWorkspace({
			id: 'current',
			tabOrder: ['doc-reference-workspace'],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			},
			viewports: {}
		});

		const restored = await persistence.restore();
		const workspace = new Workspace({
			backend: wasmBackend,
			notifier: createFakeDirtyNotifier(),
			keyboard: { getShiftHeld: () => false },
			restored: restored!
		});

		expect(workspace.activeTab.document.layer_kind_at(0)).toBe('reference');
		const placement = workspace.activeTab.document.layer_placement_at(0)!;
		expect(placement.x).toBe(1);
		expect(placement.y).toBe(2);
		expect(placement.scale).toBe(3);

		const snapshot = workspace.toSnapshot();
		const referenceLayer = expectReferenceLayer(snapshot.tabs[0].layers[0]);
		expect(referenceLayer.sourceBlob.type).toBe('image/png');
		expect(Array.from(referenceLayer.sourceRgba)).toEqual(Array.from(sourceRgba));
		expect(referenceLayer.placement).toEqual({ x: 1, y: 2, scale: 3 });
	});

	it('returns null when no saved data exists', async () => {
		const restored = await persistence.restore();

		expect(restored).toBeNull();
	});

	it('round-trips all tabs with correct names, pixel data, and order', async () => {
		const redPixels = new Uint8Array(16 * 16 * 4);
		redPixels[0] = 255; redPixels[3] = 255;

		const bluePixels = new Uint8Array(16 * 16 * 4);
		bluePixels[4] = 0; bluePixels[5] = 0; bluePixels[6] = 255; bluePixels[7] = 255;

		const snapshot = makeSnapshot({ activeTabIndex: 1 }, [
			makeTab({ id: 'doc-1', name: 'Untitled 1', pixels: redPixels }),
			makeTab({ id: 'doc-2', name: 'Untitled 2', pixels: bluePixels })
		]);

		await persistence.save(snapshot);
		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(restored!.tabs).toHaveLength(2);
		expect(restored!.tabs[0].name).toBe('Untitled 1');
		expect(restored!.tabs[1].name).toBe('Untitled 2');
		const restoredTab0Layer = expectPixelLayer(restored!.tabs[0].layers[0]);
		const restoredTab1Layer = expectPixelLayer(restored!.tabs[1].layers[0]);
		// Tab 0: red at (0,0)
		expect(restoredTab0Layer.pixels[0]).toBe(255);
		expect(restoredTab0Layer.pixels[1]).toBe(0);
		// Tab 1: blue at (1,0)
		expect(restoredTab1Layer.pixels[4]).toBe(0);
		expect(restoredTab1Layer.pixels[5]).toBe(0);
		expect(restoredTab1Layer.pixels[6]).toBe(255);
	});

	it('preserves activeTabIndex when middle tab is active', async () => {
		const snapshot = makeSnapshot({ activeTabIndex: 1 }, [
			makeTab({ id: 'doc-1', name: 'Untitled 1' }),
			makeTab({ id: 'doc-2', name: 'Untitled 2' }),
			makeTab({ id: 'doc-3', name: 'Untitled 3' })
		]);

		await persistence.save(snapshot);
		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(restored!.tabs).toHaveLength(3);
		expect(restored!.activeTabIndex).toBe(1);
		expect(restored!.tabs[1].name).toBe('Untitled 2');
	});

	it('preserves per-tab viewport state', async () => {
		const snapshot = makeSnapshot({}, [
			makeTab({
				id: 'doc-1',
				viewport: {
					pixelSize: 32, zoom: 3.0, panX: 100, panY: 0,
					showGrid: false, gridColor: '#ECE5D9'
				}
			}),
			makeTab({
				id: 'doc-2',
				viewport: {
					pixelSize: 32, zoom: 0.5, panX: 0, panY: -50,
					showGrid: true, gridColor: '#aaaaaa'
				}
			})
		]);

		await persistence.save(snapshot);
		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(restored!.tabs[0].viewport.zoom).toBe(3.0);
		expect(restored!.tabs[0].viewport.panX).toBe(100);
		expect(restored!.tabs[0].viewport.showGrid).toBe(false);
		expect(restored!.tabs[1].viewport.zoom).toBe(0.5);
		expect(restored!.tabs[1].viewport.panY).toBe(-50);
		expect(restored!.tabs[1].viewport.gridColor).toBe('#aaaaaa');
	});

	it('excludes closed tab from save and restore', async () => {
		// Save only 2 tabs (simulating that middle tab was already closed)
		const snapshot = makeSnapshot({}, [
			makeTab({ id: 'doc-1', name: 'Untitled 1' }),
			makeTab({ id: 'doc-3', name: 'Untitled 3' })
		]);

		await persistence.save(snapshot);
		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(restored!.tabs).toHaveLength(2);
		expect(restored!.tabs[0].name).toBe('Untitled 1');
		expect(restored!.tabs[1].name).toBe('Untitled 3');
	});

	it('re-save uses stable document IDs and overwrites in place', async () => {
		const snapshot = makeSnapshot({}, [
			makeTab({ id: 'doc-1' }),
			makeTab({ id: 'doc-2' })
		]);

		// First save
		await persistence.save(snapshot);
		const ws1 = await storage.getWorkspace();
		expect(ws1!.tabOrder).toHaveLength(2);

		// Second save with same IDs
		await persistence.save(snapshot);
		const ws2 = await storage.getWorkspace();

		expect(ws2!.tabOrder).toEqual(ws1!.tabOrder);
		for (const id of ws2!.tabOrder) {
			expect(await storage.getDocument(id)).toBeDefined();
		}
	});

	it('saves new documents with saved=false', async () => {
		const snapshot = makeSnapshot({}, [makeTab({ id: 'doc-new' })]);

		await persistence.save(snapshot);
		const doc = await storage.getDocument('doc-new');

		expect(doc).toBeDefined();
		expect(doc!.saved).toBe(false);
	});

	it('preserves saved=true on re-save', async () => {
		const snapshot = makeSnapshot({}, [makeTab({ id: 'doc-1' })]);
		await persistence.save(snapshot);

		// Externally mark the document as saved (simulates save dialog)
		const doc = await storage.getDocument('doc-1');
		await storage.putDocument({ ...doc!, saved: true });

		// Re-save the same snapshot
		await persistence.save(snapshot);
		const afterResave = await storage.getDocument('doc-1');

		expect(afterResave!.saved).toBe(true);
	});

	it('preserves saved=true document after tab removal', async () => {
		const snapshot = makeSnapshot({}, [
			makeTab({ id: 'doc-1' }),
			makeTab({ id: 'doc-2' })
		]);
		await persistence.save(snapshot);

		// Mark doc-2 as saved
		const doc2 = await storage.getDocument('doc-2');
		await storage.putDocument({ ...doc2!, saved: true });

		// Re-save with doc-2 tab removed
		const oneTabSnapshot = makeSnapshot({}, [makeTab({ id: 'doc-1' })]);
		await persistence.save(oneTabSnapshot);

		// doc-2 should still exist because saved=true
		expect(await storage.getDocument('doc-2')).toBeDefined();
	});

	it('preserves createdAt on re-save', async () => {
		const snapshot = makeSnapshot({}, [makeTab({ id: 'doc-1' })]);
		await persistence.save(snapshot);

		const afterFirstSave = await storage.getDocument('doc-1');
		const originalCreatedAt = afterFirstSave!.createdAt;

		// Wait a tick to ensure Date.now() advances
		await new Promise((r) => setTimeout(r, 10));

		// Re-save the same snapshot
		await persistence.save(snapshot);
		const afterResave = await storage.getDocument('doc-1');

		expect(afterResave!.createdAt).toEqual(originalCreatedAt);
		expect(afterResave!.updatedAt.getTime()).toBeGreaterThan(originalCreatedAt.getTime());
	});

	it('deletes unsaved document after tab removal', async () => {
		const snapshot = makeSnapshot({}, [
			makeTab({ id: 'doc-1' }),
			makeTab({ id: 'doc-unsaved' })
		]);
		await persistence.save(snapshot);

		// Verify doc-unsaved has saved=false (default for new docs)
		const doc = await storage.getDocument('doc-unsaved');
		expect(doc!.saved).toBe(false);

		// Re-save with doc-unsaved tab removed
		const oneTabSnapshot = makeSnapshot({}, [makeTab({ id: 'doc-1' })]);
		await persistence.save(oneTabSnapshot);

		// Unsaved document should be deleted
		expect(await storage.getDocument('doc-unsaved')).toBeUndefined();
	});

	it('deletes documents for removed tabs on re-save', async () => {
		const threeTabSnapshot = makeSnapshot({}, [
			makeTab({ id: 'doc-1' }),
			makeTab({ id: 'doc-2' }),
			makeTab({ id: 'doc-3' })
		]);

		await persistence.save(threeTabSnapshot);

		// Re-save with middle tab removed
		const twoTabSnapshot = makeSnapshot({}, [
			makeTab({ id: 'doc-1' }),
			makeTab({ id: 'doc-3' })
		]);

		await persistence.save(twoTabSnapshot);

		// Removed tab's document is deleted
		expect(await storage.getDocument('doc-2')).toBeUndefined();

		// Remaining tabs' documents still exist
		const ws = await storage.getWorkspace();
		expect(ws!.tabOrder).toHaveLength(2);
		for (const id of ws!.tabOrder) {
			expect(await storage.getDocument(id)).toBeDefined();
		}
	});

	it('clamps activeTabIndex when saved value exceeds tab count', async () => {
		// Simulate corrupted data: activeTabIndex beyond the tab count
		const layerId = crypto.randomUUID();
		const doc: DocumentRecord = {
			schemaVersion: 4,
			id: 'doc-1',
			name: 'Tab',
			width: 1,
			height: 1,
			layers: [
				{
					kind: 'pixel',
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
			updatedAt: new Date()
		};
		await storage.putDocument(doc);
		await storage.putWorkspace({
			id: 'current',
			tabOrder: ['doc-1'],
			activeTabIndex: 5,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			},
			viewports: {}
		});

		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(restored!.activeTabIndex).toBe(0);
	});

	it('isDocumentSaved returns false for a new document', async () => {
		const snapshot = makeSnapshot({}, [makeTab({ id: 'doc-new' })]);
		await persistence.save(snapshot);

		expect(await persistence.isDocumentSaved('doc-new')).toBe(false);
	});

	it('saveDocumentAs sets saved=true and updates name', async () => {
		const snapshot = makeSnapshot({}, [makeTab({ id: 'doc-1', name: 'Untitled 1' })]);
		await persistence.save(snapshot);

		await persistence.saveDocumentAs('doc-1', 'My Artwork');

		const doc = await storage.getDocument('doc-1');
		expect(doc!.saved).toBe(true);
		expect(doc!.name).toBe('My Artwork');
		expect(await persistence.isDocumentSaved('doc-1')).toBe(true);
	});

	it('deleteDocument removes document from IndexedDB', async () => {
		const snapshot = makeSnapshot({}, [makeTab({ id: 'doc-1' })]);
		await persistence.save(snapshot);
		expect(await storage.getDocument('doc-1')).toBeDefined();

		await persistence.deleteDocument('doc-1');

		expect(await storage.getDocument('doc-1')).toBeUndefined();
	});

	it('drops references for tabs no longer in the workspace on re-save', async () => {
		const refA = makeRef('ref-a');
		const refB = makeRef('ref-b');
		const twoTabs = makeSnapshot(
			{ references: { 'doc-1': [refA], 'doc-2': [refB] } },
			[makeTab({ id: 'doc-1' }), makeTab({ id: 'doc-2' })]
		);
		await persistence.save(twoTabs);

		const oneTab = makeSnapshot(
			{ references: { 'doc-1': [refA] } },
			[makeTab({ id: 'doc-1' })]
		);
		await persistence.save(oneTab);

		const ws = await storage.getWorkspace();
		expect(ws!.references).toBeDefined();
		expect(ws!.references!['doc-1']).toHaveLength(1);
		expect(ws!.references!['doc-2']).toBeUndefined();
	});

	it('round-trips reference images for the open tabs', async () => {
		const refA = makeRef('ref-a');
		const snapshot = makeSnapshot(
			{ references: { 'doc-1': [refA] } },
			[makeTab({ id: 'doc-1' })]
		);

		await persistence.save(snapshot);
		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(restored!.references).toBeDefined();
		expect(restored!.references!['doc-1']).toHaveLength(1);
		expect(restored!.references!['doc-1'][0].id).toBe('ref-a');
		expect(restored!.references!['doc-1'][0].filename).toBe('ref-a.png');
		expect(restored!.references!['doc-1'][0].naturalWidth).toBe(100);
	});

	it('round-trips display states for the open tabs', async () => {
		const refA = makeRef('ref-a');
		const displayStates: Record<string, DisplayState[]> = {
			'doc-1': [
				{
					refId: 'ref-a',
					visible: true,
					x: 10,
					y: 20,
					width: 100,
					height: 200,
					minimized: false,
					zOrder: 1
				}
			]
		};
		const snapshot = makeSnapshot(
			{ references: { 'doc-1': [refA] }, displayStates },
			[makeTab({ id: 'doc-1' })]
		);

		await persistence.save(snapshot);
		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(restored!.displayStates).toEqual(displayStates);
	});

	it('Scenario 8 — Workspace with multiple layers survives save → restore → new Workspace', async () => {
		// First session: build a multi-layer document and persist it.
		const notifier1 = createFakeDirtyNotifier();
		const ws1 = new Workspace({
			backend: wasmBackend,
			notifier: notifier1,
			keyboard: { getShiftHeld: () => false }
		});
		const tab = ws1.activeTab;
		tab.addLayer('Sketch');
		tab.addLayer('Lineart');
		const expectedLayerCount = tab.document.layer_count();
		const expectedActiveId = tab.document.active_layer_id();
		const expectedNext = tab.document.next_layer_number();
		const expectedLayerIds = Array.from(
			{ length: expectedLayerCount },
			(_, i) => tab.document.layer_id_at(i)!
		);

		await persistence.save(ws1.toSnapshot());

		// Second session: a fresh Workspace hydrated from the restored snapshot.
		const restored = await persistence.restore();
		expect(restored).not.toBeNull();

		const ws2 = new Workspace({
			backend: wasmBackend,
			notifier: createFakeDirtyNotifier(),
			keyboard: { getShiftHeld: () => false },
			restored: restored!
		});

		expect(ws2.tabs).toHaveLength(1);
		const restoredTab = ws2.activeTab;
		expect(restoredTab.document.layer_count()).toBe(expectedLayerCount);
		expect(restoredTab.document.active_layer_id()).toBe(expectedActiveId);
		expect(restoredTab.document.next_layer_number()).toBe(expectedNext);
		for (let i = 0; i < expectedLayerCount; i++) {
			expect(restoredTab.document.layer_id_at(i)).toBe(expectedLayerIds[i]);
		}
	});

	it('returns null when workspace references a missing document', async () => {
		await storage.putWorkspace({
			id: 'current',
			tabOrder: ['non-existent-doc'],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			},
			viewports: {}
		});

		const restored = await persistence.restore();

		expect(restored).toBeNull();
	});
});
