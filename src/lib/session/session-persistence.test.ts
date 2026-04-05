// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionPersistence } from './session-persistence';
import { SessionStorage } from './session-storage';
import { Workspace } from '$lib/canvas/workspace.svelte';
import { WasmPixelCanvas, WasmColor } from '$wasm/dotorixel_wasm';

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
		workspace.activeEditor.pixelCanvas.set_pixel(0, 0, red);
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

	it('saves only the active tab with activeTabIndex 0 when multiple tabs exist', async () => {
		const workspace = new Workspace({ gridColor: '#ECE5D9' });
		workspace.addTab(); // Now 2 tabs, activeTabIndex = 1

		await persistence.save(workspace);
		const restored = await persistence.restore();

		expect(restored).not.toBeNull();
		expect(restored!.tabs).toHaveLength(1);
		expect(restored!.activeTabIndex).toBe(0);
		expect(restored!.tabs[0].name).toBe('Untitled 2');
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
