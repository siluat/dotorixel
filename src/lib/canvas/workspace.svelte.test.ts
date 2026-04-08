// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { Workspace } from './workspace.svelte';
import type { WorkspaceInit } from '$lib/session/workspace-init-types';

describe('Workspace', () => {
	it('initializes with a single "Untitled 1" tab', () => {
		const workspace = new Workspace();

		expect(workspace.tabs).toHaveLength(1);
		expect(workspace.activeTabIndex).toBe(0);
		expect(workspace.activeEditor).toBe(workspace.tabs[0]);
		expect(workspace.activeEditor.name).toBe('Untitled 1');
	});

	it('addTab() creates a new tab with sequential name and sets it active', () => {
		const workspace = new Workspace();

		workspace.addTab();

		expect(workspace.tabs).toHaveLength(2);
		expect(workspace.activeTabIndex).toBe(1);
		expect(workspace.activeEditor.name).toBe('Untitled 2');
	});

	it('closing the active tab activates the right neighbor', () => {
		const workspace = new Workspace();
		workspace.addTab();
		workspace.addTab();
		// tabs: [Untitled 1, Untitled 2, Untitled 3], active = 2 (Untitled 3)
		workspace.setActiveTab(1);
		// active = 1 (Untitled 2)

		workspace.closeTab(1);

		expect(workspace.tabs).toHaveLength(2);
		expect(workspace.activeEditor.name).toBe('Untitled 3');
	});

	it('closing the rightmost active tab activates the left neighbor', () => {
		const workspace = new Workspace();
		workspace.addTab();
		// tabs: [Untitled 1, Untitled 2], active = 1 (Untitled 2)

		workspace.closeTab(1);

		expect(workspace.tabs).toHaveLength(1);
		expect(workspace.activeEditor.name).toBe('Untitled 1');
	});

	it('closing the last remaining tab is a no-op', () => {
		const workspace = new Workspace();

		workspace.closeTab(0);

		expect(workspace.tabs).toHaveLength(1);
		expect(workspace.activeEditor.name).toBe('Untitled 1');
	});

	it('closing a non-active tab preserves the current active tab', () => {
		const workspace = new Workspace();
		workspace.addTab();
		workspace.addTab();
		// tabs: [Untitled 1, Untitled 2, Untitled 3], active = 2 (Untitled 3)

		workspace.closeTab(0);

		expect(workspace.tabs).toHaveLength(2);
		expect(workspace.activeEditor.name).toBe('Untitled 3');
	});

	it('setActiveTab() switches the active tab', () => {
		const workspace = new Workspace();
		workspace.addTab();
		// tabs: [Untitled 1, Untitled 2], active = 1

		workspace.setActiveTab(0);

		expect(workspace.activeEditor.name).toBe('Untitled 1');
	});

	it('reuses the smallest available number after closing a tab', () => {
		const workspace = new Workspace();
		workspace.addTab();
		// tabs: [Untitled 1, Untitled 2]
		workspace.closeTab(1);
		// tabs: [Untitled 1]

		workspace.addTab();

		expect(workspace.activeEditor.name).toBe('Untitled 2');
	});

	it('fills gaps in tab numbering', () => {
		const workspace = new Workspace();
		workspace.addTab();
		workspace.addTab();
		// tabs: [Untitled 1, Untitled 2, Untitled 3], active = 2
		workspace.closeTab(1);
		// tabs: [Untitled 1, Untitled 3]

		workspace.addTab();

		expect(workspace.activeEditor.name).toBe('Untitled 2');
	});

	it('all tabs share the same SharedState', () => {
		const workspace = new Workspace();
		workspace.addTab();

		workspace.tabs[0].activeTool = 'eraser';

		expect(workspace.tabs[1].activeTool).toBe('eraser');
	});

	it('forwards initial foregroundColor to activeEditor', () => {
		const customColor = { r: 45, g: 45, b: 45, a: 255 };

		const workspace = new Workspace({ foregroundColor: customColor });

		expect(workspace.activeEditor.foregroundColor).toEqual(customColor);
	});

	it('initializes from saved data with correct tab name and canvas', () => {
		const pixels = new Uint8Array([255, 0, 0, 255]);
		const init: WorkspaceInit = {
			tabs: [
				{
					id: 'doc-1',
					name: 'My Sprite',
					width: 1,
					height: 1,
					pixels,
					viewport: { pixelSize: 32, zoom: 2.0, panX: 10, panY: 20, showGrid: true, gridColor: '#ECE5D9' }
				}
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'eraser',
				foregroundColor: { r: 255, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 0, g: 0, b: 255, a: 255 },
				recentColors: ['#ff0000']
			}
		};

		const workspace = new Workspace({ init });

		expect(workspace.tabs).toHaveLength(1);
		expect(workspace.activeEditor.name).toBe('My Sprite');
		expect(workspace.activeEditor.pixelCanvas.width).toBe(1);
		expect(workspace.activeEditor.pixelCanvas.height).toBe(1);
		expect(workspace.activeEditor.pixelCanvas.pixels()).toEqual(pixels);
	});

	it('initializes from saved data with correct shared state', () => {
		const init: WorkspaceInit = {
			tabs: [
				{
					id: 'doc-1',
					name: 'Tab 1',
					width: 1,
					height: 1,
					pixels: new Uint8Array([0, 0, 0, 255]),
					viewport: { pixelSize: 32, zoom: 1.0, panX: 0, panY: 0, showGrid: true, gridColor: '#cccccc' }
				}
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'line',
				foregroundColor: { r: 100, g: 50, b: 25, a: 255 },
				backgroundColor: { r: 200, g: 200, b: 200, a: 255 },
				recentColors: ['#ff0000', '#00ff00']
			}
		};

		const workspace = new Workspace({ init });

		expect(workspace.activeEditor.activeTool).toBe('line');
		expect(workspace.activeEditor.foregroundColor).toEqual({ r: 100, g: 50, b: 25, a: 255 });
		expect(workspace.activeEditor.backgroundColor).toEqual({ r: 200, g: 200, b: 200, a: 255 });
		expect(workspace.activeEditor.recentColors).toEqual(['#ff0000', '#00ff00']);
	});

	it('new tabs after restore do not duplicate restored tab names', () => {
		const init: WorkspaceInit = {
			tabs: [
				{
					id: 'doc-1',
					name: 'Untitled 2',
					width: 1,
					height: 1,
					pixels: new Uint8Array([0, 0, 0, 255]),
					viewport: { pixelSize: 32, zoom: 1.0, panX: 0, panY: 0, showGrid: true, gridColor: '#cccccc' }
				}
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			}
		};

		const workspace = new Workspace({ init });
		workspace.addTab();

		expect(workspace.tabs[1].name).toBe('Untitled 1');
	});

	it('forwards gridColor to initial tab', () => {
		const workspace = new Workspace({ gridColor: '#ECE5D9' });

		expect(workspace.activeEditor.viewport.gridColor).toBe('#ECE5D9');
	});

	it('new tabs also receive the configured gridColor', () => {
		const workspace = new Workspace({ gridColor: '#ECE5D9' });

		workspace.addTab();

		expect(workspace.tabs[1].viewport.gridColor).toBe('#ECE5D9');
	});
});
