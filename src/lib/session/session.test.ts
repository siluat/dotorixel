// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { openSession } from './session';
import { SessionStorage } from './session-storage';
import type { Color } from '$lib/canvas/color';
import type { ViewportData } from '$lib/canvas/viewport';
import type { TabState } from '$lib/canvas/editor-session/tab-state.svelte';

function setPixel(tab: TabState, x: number, y: number, color: Color) {
	tab.shared.foregroundColor = color;
	tab.shared.activeTool = 'pencil';
	tab.drawStart(0, 'mouse');
	tab.draw({ x, y }, null);
	tab.drawEnd();
}

describe('openSession', () => {
	afterEach(() => {
		indexedDB.deleteDatabase('dotorixel');
	});

	it('returns a workspace with one default tab when no prior session exists', async () => {
		const { workspace, session } = await openSession({
			gridColor: '#ECE5D9'
		});

		expect(workspace.tabs).toHaveLength(1);
		expect(workspace.activeIndex).toBe(0);

		session.dispose();
	});

	it('preserves pixel data across save and restore', async () => {
		const { workspace, session } = await openSession({
			gridColor: '#ECE5D9'
		});

		setPixel(workspace.activeTab, 0, 0, { r: 255, g: 0, b: 0, a: 255 });
		session.markDirty(workspace.activeTab.documentId);
		await session.flush();
		session.dispose();

		const { workspace: restored, session: session2 } = await openSession({
			gridColor: '#ECE5D9'
		});

		const pixels = restored.activeTab.document.composite();
		expect(pixels[0]).toBe(255); // R
		expect(pixels[1]).toBe(0); // G
		expect(pixels[2]).toBe(0); // B
		expect(pixels[3]).toBe(255); // A

		session2.dispose();
	});

	it('preserves multiple tabs with per-tab viewport state', async () => {
		const { workspace, session } = await openSession({
			gridColor: '#ECE5D9'
		});

		// Tab 0: draw red pixel, zoom to 3x
		setPixel(workspace.activeTab, 0, 0, { r: 255, g: 0, b: 0, a: 255 });
		workspace.activeTab.setViewport({
			pixelSize: 32, zoom: 3.0, panX: 100, panY: -50,
			showGrid: false, gridColor: '#ECE5D9', showOnionSkin: false
		} satisfies ViewportData);
		session.markDirty(workspace.activeTab.documentId);

		// Tab 1: draw blue pixel
		workspace.addTab();
		setPixel(workspace.activeTab, 1, 0, { r: 0, g: 0, b: 255, a: 255 });
		session.markDirty(workspace.activeTab.documentId);

		await session.flush();
		session.dispose();

		const { workspace: restored, session: session2 } = await openSession({
			gridColor: '#ECE5D9'
		});

		expect(restored.tabs).toHaveLength(2);

		// Tab 0: pixel + viewport preserved
		const px0 = restored.tabs[0].document.composite();
		expect(px0[0]).toBe(255); // R
		expect(restored.tabs[0].viewport.zoom).toBe(3.0);
		expect(restored.tabs[0].viewport.panX).toBe(100);
		expect(restored.tabs[0].viewport.showGrid).toBe(false);

		// Tab 1: pixel preserved
		const px1 = restored.tabs[1].document.composite();
		expect(px1[4]).toBe(0); // R
		expect(px1[5]).toBe(0); // G
		expect(px1[6]).toBe(255); // B

		session2.dispose();
	});

	it('removes closed tab from storage on next save', async () => {
		const { workspace, session } = await openSession({
			gridColor: '#ECE5D9'
		});

		workspace.addTab();
		workspace.addTab(); // 3 tabs
		for (const tab of workspace.tabs) {
			session.markDirty(tab.documentId);
		}
		await session.flush();

		// Close middle tab — Workspace.closeTab auto-emits notifyTabRemoved via the notifier.
		const removedDocId = workspace.tabs[1].documentId;
		workspace.closeTab(1);
		await session.flush();
		session.dispose();

		const { workspace: restored, session: session2 } = await openSession({
			gridColor: '#ECE5D9'
		});

		expect(restored.tabs).toHaveLength(2);
		expect(restored.tabs.every((t) => t.documentId !== removedDocId)).toBe(true);

		session2.dispose();
	});

	it('batches rapid markDirty calls into a single save via debounce', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

		const { workspace, session } = await openSession({
			gridColor: '#ECE5D9',
			debounceMs: 3000
		});

		const docId = workspace.activeTab.documentId;
		session.markDirty(docId);
		vi.advanceTimersByTime(1000);
		session.markDirty(docId);
		vi.advanceTimersByTime(1000);
		session.markDirty(docId);

		// Before debounce expires: nothing saved yet
		const { workspace: before, session: sessionBefore } = await openSession({
			gridColor: '#ECE5D9'
		});
		expect(before.tabs[0].documentId).not.toBe(docId);
		sessionBefore.dispose();

		// After debounce + flush
		vi.advanceTimersByTime(3000);
		await session.flush();
		session.dispose();

		vi.useRealTimers();

		const { workspace: after, session: session2 } = await openSession({
			gridColor: '#ECE5D9'
		});
		expect(after.tabs).toHaveLength(1);

		session2.dispose();
	});

	it('flush does not error when nothing is dirty', async () => {
		const { session } = await openSession({
			gridColor: '#ECE5D9'
		});

		await expect(session.flush()).resolves.toBeUndefined();

		session.dispose();
	});

	it('returns a fresh workspace with no-op session when IndexedDB fails', async () => {
		vi.spyOn(SessionStorage, 'open').mockRejectedValueOnce(new Error('IndexedDB unavailable'));

		const { workspace, session } = await openSession({
			gridColor: '#ECE5D9'
		});

		expect(workspace.tabs).toHaveLength(1);

		// All methods should be callable without throwing
		session.markDirty('any-id');
		session.notifyTabClosed('any-id');
		await session.flush();
		session.dispose();
	});
});
