// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { openSession } from './session';
import { SessionStorage } from './session-storage';
import { WasmPixelCanvas, WasmColor, WasmViewport } from '$wasm/dotorixel_wasm';
import type { PixelCanvas } from '$lib/canvas/pixel-canvas';

function wasmCanvas(canvas: PixelCanvas): WasmPixelCanvas {
	if (canvas instanceof WasmPixelCanvas) return canvas;
	throw new Error('Expected WasmPixelCanvas');
}

describe('openSession', () => {
	afterEach(() => {
		indexedDB.deleteDatabase('dotorixel');
	});

	it('returns a workspace with one default tab when no prior session exists', async () => {
		const { workspace, session } = await openSession({ gridColor: '#ECE5D9' });

		expect(workspace.tabs).toHaveLength(1);
		expect(workspace.activeTabIndex).toBe(0);

		session.dispose();
	});

	it('preserves pixel data across save and restore', async () => {
		const { workspace, session } = await openSession({ gridColor: '#ECE5D9' });

		const red = new WasmColor(255, 0, 0, 255);
		wasmCanvas(workspace.activeEditor.pixelCanvas).set_pixel(0, 0, red);
		session.markDirty(workspace.activeEditor.documentId);
		await session.flush();
		session.dispose();

		const { workspace: restored, session: session2 } = await openSession({
			gridColor: '#ECE5D9'
		});

		const pixels = restored.activeEditor.pixelCanvas.pixels();
		expect(pixels[0]).toBe(255); // R
		expect(pixels[1]).toBe(0); // G
		expect(pixels[2]).toBe(0); // B
		expect(pixels[3]).toBe(255); // A

		session2.dispose();
	});

	it('preserves multiple tabs with per-tab viewport state', async () => {
		const { workspace, session } = await openSession({ gridColor: '#ECE5D9' });

		// Tab 0: draw red pixel, zoom to 3x
		const red = new WasmColor(255, 0, 0, 255);
		wasmCanvas(workspace.activeEditor.pixelCanvas).set_pixel(0, 0, red);
		workspace.activeEditor.viewportState = {
			viewport: new WasmViewport(32, 3.0, 100, -50),
			showGrid: false,
			gridColor: '#ECE5D9'
		};
		session.markDirty(workspace.activeEditor.documentId);

		// Tab 1: draw blue pixel
		workspace.addTab();
		const blue = new WasmColor(0, 0, 255, 255);
		wasmCanvas(workspace.activeEditor.pixelCanvas).set_pixel(1, 0, blue);
		session.markDirty(workspace.activeEditor.documentId);

		await session.flush();
		session.dispose();

		const { workspace: restored, session: session2 } = await openSession({
			gridColor: '#ECE5D9'
		});

		expect(restored.tabs).toHaveLength(2);

		// Tab 0: pixel + viewport preserved
		const px0 = restored.tabs[0].pixelCanvas.pixels();
		expect(px0[0]).toBe(255); // R
		expect(restored.tabs[0].viewportState.viewport.zoom).toBe(3.0);
		expect(restored.tabs[0].viewportState.viewport.pan_x).toBe(100);
		expect(restored.tabs[0].viewportState.showGrid).toBe(false);

		// Tab 1: pixel preserved
		const px1 = restored.tabs[1].pixelCanvas.pixels();
		expect(px1[4]).toBe(0); // R
		expect(px1[5]).toBe(0); // G
		expect(px1[6]).toBe(255); // B

		session2.dispose();
	});

	it('removes closed tab from storage on next save', async () => {
		const { workspace, session } = await openSession({ gridColor: '#ECE5D9' });

		workspace.addTab();
		workspace.addTab(); // 3 tabs
		for (const tab of workspace.tabs) {
			session.markDirty(tab.documentId);
		}
		await session.flush();

		// Close middle tab
		const removedDocId = workspace.tabs[1].documentId;
		workspace.closeTab(1);
		session.notifyTabClosed(removedDocId);
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

		const docId = workspace.activeEditor.documentId;
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
		const { session } = await openSession({ gridColor: '#ECE5D9' });

		await expect(session.flush()).resolves.toBeUndefined();

		session.dispose();
	});

	it('returns a fresh workspace with no-op session when IndexedDB fails', async () => {
		vi.spyOn(SessionStorage, 'open').mockRejectedValueOnce(new Error('IndexedDB unavailable'));

		const { workspace, session } = await openSession({ gridColor: '#ECE5D9' });

		expect(workspace.tabs).toHaveLength(1);

		// All methods should be callable without throwing
		session.markDirty('any-id');
		session.notifyTabClosed('any-id');
		await session.flush();
		session.dispose();
	});
});
