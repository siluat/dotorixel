// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionPersistence, type PersistableWorkspace } from './session-persistence';
import { SessionStorage } from './session-storage';

function makeTab(overrides: Partial<PersistableWorkspace['tabs'][number]> = {}) {
	return {
		id: 'doc-1',
		name: 'Untitled 1',
		width: 16,
		height: 16,
		pixels: new Uint8Array(16 * 16 * 4),
		viewport: {
			pixelSize: 32, zoom: 1.0, panX: 0, panY: 0,
			showGrid: true, gridColor: '#cccccc'
		},
		...overrides
	};
}

function makeSnapshot(
	overrides: Partial<PersistableWorkspace> = {},
	tabs?: PersistableWorkspace['tabs']
): PersistableWorkspace {
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
		expect(restored!.tabs[0].pixels[0]).toBe(255); // R
		expect(restored!.tabs[0].pixels[1]).toBe(0);   // G
		expect(restored!.tabs[0].pixels[2]).toBe(0);   // B
		expect(restored!.tabs[0].pixels[3]).toBe(255); // A
		// Verify shared state
		expect(restored!.sharedState.activeTool).toBe('line');
		expect(restored!.sharedState.foregroundColor).toEqual({ r: 200, g: 50, b: 30, a: 255 });
		expect(restored!.activeTabIndex).toBe(0);
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
		// Tab 0: red at (0,0)
		expect(restored!.tabs[0].pixels[0]).toBe(255);
		expect(restored!.tabs[0].pixels[1]).toBe(0);
		// Tab 1: blue at (1,0)
		expect(restored!.tabs[1].pixels[4]).toBe(0);
		expect(restored!.tabs[1].pixels[5]).toBe(0);
		expect(restored!.tabs[1].pixels[6]).toBe(255);
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
		const doc = {
			schemaVersion: 2 as const,
			id: 'doc-1',
			name: 'Tab',
			width: 1,
			height: 1,
			pixels: new Uint8Array([0, 0, 0, 255]),
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
