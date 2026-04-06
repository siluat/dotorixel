// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutoSave } from './auto-save';
import { SessionPersistence } from './session-persistence';
import { SessionStorage } from './session-storage';
import { Workspace } from '$lib/canvas/workspace.svelte';

describe('AutoSave', () => {
	let storage: SessionStorage;
	let persistence: SessionPersistence;
	let workspace: Workspace;
	let autoSave: AutoSave;

	beforeEach(async () => {
		storage = await SessionStorage.open();
		persistence = new SessionPersistence(storage);
		workspace = new Workspace({ gridColor: '#ECE5D9' });
		autoSave = new AutoSave(persistence, workspace, 3000);
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
		workspace.addTab(); // 2 tabs

		// Initial full save — mark both documents dirty
		for (const tab of workspace.tabs) {
			autoSave.markDirty(tab.documentId);
		}
		await autoSave.flush();

		const putSpy = vi.spyOn(storage, 'putDocument');

		// Mark only the second tab as dirty
		autoSave.markDirty(workspace.tabs[1].documentId);
		await autoSave.flush();

		// Only the dirty document was written
		expect(putSpy).toHaveBeenCalledTimes(1);
		expect(putSpy.mock.calls[0][0]).toHaveProperty('id', workspace.tabs[1].documentId);
	});

	it('deletes closed tab documents from IndexedDB on save', async () => {
		workspace.addTab(); // 2 tabs

		// Initial full save
		for (const tab of workspace.tabs) {
			autoSave.markDirty(tab.documentId);
		}
		await autoSave.flush();

		const removedDocId = workspace.tabs[1].documentId;

		// Close tab and notify auto-save
		workspace.closeTab(1);
		autoSave.notifyTabRemoved(removedDocId);
		await autoSave.flush();

		// Removed document is deleted from IndexedDB
		expect(await storage.getDocument(removedDocId)).toBeUndefined();
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
