// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { WorkspaceSnapshot, TabSnapshot } from '$lib/canvas/workspace-snapshot';
import { AutoSave } from './auto-save';
import { SessionPersistence } from './session-persistence';
import { SessionStorage } from './session-storage';

function makeTab(
	overrides: Partial<TabSnapshot> = {}
): TabSnapshot {
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
	overrides: Partial<WorkspaceSnapshot> = {},
	tabs?: TabSnapshot[]
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

describe('AutoSave', () => {
	let storage: SessionStorage;
	let persistence: SessionPersistence;
	let currentSnapshot: WorkspaceSnapshot;
	let autoSave: AutoSave;

	beforeEach(async () => {
		storage = await SessionStorage.open();
		persistence = new SessionPersistence(storage);
		currentSnapshot = makeSnapshot();
		autoSave = new AutoSave(persistence, () => currentSnapshot, 3000);
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
	});

	afterEach(() => {
		autoSave.dispose();
		storage.close();
		indexedDB.deleteDatabase('dotorixel');
		vi.useRealTimers();
	});

	it('batches rapid changes into a single save', async () => {
		const saveSpy = vi.spyOn(persistence, 'save');

		autoSave.markDirty();
		vi.advanceTimersByTime(1000);
		autoSave.markDirty();
		vi.advanceTimersByTime(1000);
		autoSave.markDirty();

		// 3 seconds from the LAST markDirty, not the first
		vi.advanceTimersByTime(3000);
		await autoSave.flush();

		expect(saveSpy).toHaveBeenCalledTimes(1);
	});

	it('does not save again after dirty flag is cleared', async () => {
		const saveSpy = vi.spyOn(persistence, 'save');

		autoSave.markDirty();
		await autoSave.flush();
		expect(saveSpy).toHaveBeenCalledTimes(1);

		// Second flush without new changes — should not save
		await autoSave.flush();
		expect(saveSpy).toHaveBeenCalledTimes(1);
	});

	it('flush does not save when nothing is dirty', async () => {
		const saveSpy = vi.spyOn(persistence, 'save');

		await autoSave.flush();

		expect(saveSpy).not.toHaveBeenCalled();
	});

	it('flush saves immediately without waiting for debounce', async () => {
		autoSave.markDirty();

		// Don't advance time at all — flush should save right away
		await autoSave.flush();

		const ws = await storage.getWorkspace();
		expect(ws).toBeDefined();
		expect(ws!.tabOrder).toHaveLength(1);
	});

	it('only writes dirty documents to IndexedDB', async () => {
		currentSnapshot = makeSnapshot({}, [
			makeTab({ id: 'doc-1' }),
			makeTab({ id: 'doc-2' })
		]);

		// Initial full save — mark both documents dirty
		autoSave.markDirty('doc-1');
		autoSave.markDirty('doc-2');
		await autoSave.flush();

		const putSpy = vi.spyOn(storage, 'putDocument');

		// Mark only the second tab as dirty
		autoSave.markDirty('doc-2');
		await autoSave.flush();

		// Only the dirty document was written
		expect(putSpy).toHaveBeenCalledTimes(1);
		expect(putSpy.mock.calls[0][0]).toHaveProperty('id', 'doc-2');
	});

	it('deletes closed tab documents from IndexedDB on save', async () => {
		currentSnapshot = makeSnapshot({}, [
			makeTab({ id: 'doc-1' }),
			makeTab({ id: 'doc-2' })
		]);

		// Initial full save
		autoSave.markDirty('doc-1');
		autoSave.markDirty('doc-2');
		await autoSave.flush();

		// Simulate closing tab: update snapshot and notify
		currentSnapshot = makeSnapshot({}, [
			makeTab({ id: 'doc-1' })
		]);
		autoSave.notifyTabRemoved('doc-2');
		await autoSave.flush();

		// Removed document is deleted from IndexedDB
		expect(await storage.getDocument('doc-2')).toBeUndefined();
		// Remaining document still exists
		const ws = await storage.getWorkspace();
		expect(ws!.tabOrder).toHaveLength(1);
		expect(await storage.getDocument(ws!.tabOrder[0])).toBeDefined();
	});

	it('saves to IndexedDB after debounce interval', async () => {
		autoSave.markDirty();

		// Before debounce: nothing saved yet
		expect(await storage.getWorkspace()).toBeUndefined();

		// Fire the debounce timer, then wait for the in-flight save
		vi.advanceTimersByTime(3000);
		await autoSave.flush();

		const ws = await storage.getWorkspace();
		expect(ws).toBeDefined();
		expect(ws!.tabOrder).toHaveLength(1);
	});
});
