// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionPersistence } from './session-persistence';
import { SessionStorage } from './session-storage';
import { Workspace } from '$lib/canvas/workspace.svelte';
import { WasmPixelCanvas, WasmColor, WasmViewport } from '$wasm/dotorixel_wasm';
import type { PixelCanvas } from '$lib/canvas/pixel-canvas';

function wasmCanvas(canvas: PixelCanvas): WasmPixelCanvas {
	if (canvas instanceof WasmPixelCanvas) return canvas;
	throw new Error('Expected WasmPixelCanvas');
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
		const workspace = new Workspace({
			foregroundColor: { r: 200, g: 50, b: 30, a: 255 },
			gridColor: '#ECE5D9'
		});
		// Draw a red pixel at (0,0)
		const red = new WasmColor(255, 0, 0, 255);
		wasmCanvas(workspace.activeEditor.pixelCanvas).set_pixel(0, 0, red);
		workspace.activeEditor.activeTool = 'line';

		await persistence.save(workspace);
		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(restored!.tabs).toHaveLength(1);
		expect(restored!.tabs[0].name).toBe('Untitled 1');
		expect(restored!.tabs[0].width).toBe(16);
		expect(restored!.tabs[0].height).toBe(16);
		// Verify pixel data includes the red pixel we drew
		const pixels = restored!.tabs[0].pixels;
		expect(pixels[0]).toBe(255); // R
		expect(pixels[1]).toBe(0);   // G
		expect(pixels[2]).toBe(0);   // B
		expect(pixels[3]).toBe(255); // A
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
		const workspace = new Workspace({ gridColor: '#ECE5D9' });
		// Tab 0: "Untitled 1" — draw red pixel at (0,0)
		const red = new WasmColor(255, 0, 0, 255);
		wasmCanvas(workspace.activeEditor.pixelCanvas).set_pixel(0, 0, red);

		// Tab 1: "Untitled 2" — draw blue pixel at (1,0)
		workspace.addTab();
		const blue = new WasmColor(0, 0, 255, 255);
		wasmCanvas(workspace.activeEditor.pixelCanvas).set_pixel(1, 0, blue);

		// Active tab is 1 (the newly added tab)
		await persistence.save(workspace);
		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(restored!.tabs).toHaveLength(2);
		// Tab order preserved
		expect(restored!.tabs[0].name).toBe('Untitled 1');
		expect(restored!.tabs[1].name).toBe('Untitled 2');
		// Tab 0 pixel data: red at (0,0)
		const px0 = restored!.tabs[0].pixels;
		expect(px0[0]).toBe(255); // R
		expect(px0[1]).toBe(0);   // G
		expect(px0[2]).toBe(0);   // B
		// Tab 1 pixel data: blue at (1,0)
		const px1 = restored!.tabs[1].pixels;
		expect(px1[4]).toBe(0);   // R
		expect(px1[5]).toBe(0);   // G
		expect(px1[6]).toBe(255); // B
	});

	it('preserves activeTabIndex when middle tab is active', async () => {
		const workspace = new Workspace({ gridColor: '#ECE5D9' });
		workspace.addTab(); // Tab 1
		workspace.addTab(); // Tab 2
		// 3 tabs total, tab 2 is active. Switch to middle tab.
		workspace.setActiveTab(1);

		await persistence.save(workspace);
		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(restored!.tabs).toHaveLength(3);
		expect(restored!.activeTabIndex).toBe(1);
		expect(restored!.tabs[1].name).toBe('Untitled 2');
	});

	it('preserves per-tab viewport state', async () => {
		const workspace = new Workspace({ gridColor: '#ECE5D9' });
		// Tab 0: zoom in, pan right, grid off
		workspace.tabs[0].viewportState = {
			viewport: new WasmViewport(32, 3.0, 100, 0),
			showGrid: false,
			gridColor: '#ECE5D9'
		};

		// Tab 1: different viewport
		workspace.addTab();
		workspace.tabs[1].viewportState = {
			viewport: new WasmViewport(32, 0.5, 0, -50),
			showGrid: true,
			gridColor: '#aaaaaa'
		};

		await persistence.save(workspace);
		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		// Tab 0 viewport
		expect(restored!.tabs[0].viewport.zoom).toBe(3.0);
		expect(restored!.tabs[0].viewport.panX).toBe(100);
		expect(restored!.tabs[0].viewport.showGrid).toBe(false);
		// Tab 1 viewport
		expect(restored!.tabs[1].viewport.zoom).toBe(0.5);
		expect(restored!.tabs[1].viewport.panY).toBe(-50);
		expect(restored!.tabs[1].viewport.gridColor).toBe('#aaaaaa');
	});

	it('excludes closed tab from save and restore', async () => {
		const workspace = new Workspace({ gridColor: '#ECE5D9' });
		workspace.addTab(); // Tab 1: "Untitled 2"
		workspace.addTab(); // Tab 2: "Untitled 3"

		// Close middle tab
		workspace.closeTab(1);

		await persistence.save(workspace);
		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(restored!.tabs).toHaveLength(2);
		expect(restored!.tabs[0].name).toBe('Untitled 1');
		expect(restored!.tabs[1].name).toBe('Untitled 3');
	});

	it('re-save uses stable document IDs and overwrites in place', async () => {
		const workspace = new Workspace({ gridColor: '#ECE5D9' });
		workspace.addTab();

		// First save: 2 tabs
		await persistence.save(workspace);
		const ws1 = await storage.getWorkspace();
		const firstSaveDocIds = ws1!.tabOrder;
		expect(firstSaveDocIds).toHaveLength(2);

		// Second save: same 2 tabs with stable IDs
		await persistence.save(workspace);
		const ws2 = await storage.getWorkspace();
		const secondSaveDocIds = ws2!.tabOrder;

		// Same document IDs used across saves
		expect(secondSaveDocIds).toEqual(firstSaveDocIds);

		// Documents still exist (overwritten, not re-created)
		for (const id of secondSaveDocIds) {
			const doc = await storage.getDocument(id);
			expect(doc).toBeDefined();
		}
	});

	it('deletes documents for removed tabs on re-save', async () => {
		const workspace = new Workspace({ gridColor: '#ECE5D9' });
		workspace.addTab();
		workspace.addTab(); // 3 tabs

		await persistence.save(workspace);
		const removedDocId = workspace.tabs[1].documentId;

		// Close the middle tab
		workspace.closeTab(1);
		await persistence.save(workspace);

		// Removed tab's document is deleted
		const doc = await storage.getDocument(removedDocId);
		expect(doc).toBeUndefined();

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
			id: 'doc-1',
			name: 'Tab',
			width: 1,
			height: 1,
			pixels: new Uint8Array([0, 0, 0, 255]),
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
		// Write a workspace record that points to a non-existent document
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
