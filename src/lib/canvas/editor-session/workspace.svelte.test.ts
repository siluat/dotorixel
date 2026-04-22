// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { Workspace, type WorkspaceDeps } from './workspace.svelte';
import { wasmBackend } from '../wasm-backend';
import { createFakeDirtyNotifier } from './fake-dirty-notifier';
import type { WorkspaceSnapshot } from '../workspace-snapshot';

function makeWorkspace(overrides: Omit<Partial<WorkspaceDeps>, 'notifier'> = {}) {
	const notifier = createFakeDirtyNotifier();
	const workspace = new Workspace({
		backend: wasmBackend,
		notifier,
		keyboard: { getShiftHeld: () => false },
		...overrides
	});
	return { workspace, notifier };
}

describe('Workspace — initialization', () => {
	it('starts with a single "Untitled 1" tab', () => {
		const { workspace } = makeWorkspace();

		expect(workspace.tabs).toHaveLength(1);
		expect(workspace.activeIndex).toBe(0);
		expect(workspace.activeTab).toBe(workspace.tabs[0]);
		expect(workspace.activeTab.name).toBe('Untitled 1');
	});

	it('forwards initialForegroundColor to the first tab', () => {
		const customColor = { r: 45, g: 45, b: 45, a: 255 };
		const { workspace } = makeWorkspace({ initialForegroundColor: customColor });

		expect(workspace.shared.foregroundColor).toEqual(customColor);
	});

	it('forwards gridColor to the initial tab', () => {
		const { workspace } = makeWorkspace({ gridColor: '#ECE5D9' });

		expect(workspace.activeTab.viewport.gridColor).toBe('#ECE5D9');
	});
});

describe('Workspace — tab lifecycle', () => {
	it('addTab creates a new tab with the next Untitled number and activates it', () => {
		const { workspace } = makeWorkspace();

		workspace.addTab();

		expect(workspace.tabs).toHaveLength(2);
		expect(workspace.activeIndex).toBe(1);
		expect(workspace.activeTab.name).toBe('Untitled 2');
	});

	it('new tabs inherit the configured gridColor', () => {
		const { workspace } = makeWorkspace({ gridColor: '#ECE5D9' });

		workspace.addTab();

		expect(workspace.tabs[1].viewport.gridColor).toBe('#ECE5D9');
	});

	it('closing the active tab activates the right neighbor', () => {
		const { workspace } = makeWorkspace();
		workspace.addTab();
		workspace.addTab();
		workspace.setActiveTab(1);

		workspace.closeTab(1);

		expect(workspace.tabs).toHaveLength(2);
		expect(workspace.activeTab.name).toBe('Untitled 3');
	});

	it('closing the rightmost active tab activates the left neighbor', () => {
		const { workspace } = makeWorkspace();
		workspace.addTab();

		workspace.closeTab(1);

		expect(workspace.tabs).toHaveLength(1);
		expect(workspace.activeTab.name).toBe('Untitled 1');
	});

	it('closing the last remaining tab is a no-op', () => {
		const { workspace } = makeWorkspace();

		workspace.closeTab(0);

		expect(workspace.tabs).toHaveLength(1);
		expect(workspace.activeTab.name).toBe('Untitled 1');
	});

	it('closing a non-active tab preserves the current active tab', () => {
		const { workspace } = makeWorkspace();
		workspace.addTab();
		workspace.addTab();

		workspace.closeTab(0);

		expect(workspace.tabs).toHaveLength(2);
		expect(workspace.activeTab.name).toBe('Untitled 3');
	});

	it('setActiveTab switches the active tab', () => {
		const { workspace } = makeWorkspace();
		workspace.addTab();

		workspace.setActiveTab(0);

		expect(workspace.activeTab.name).toBe('Untitled 1');
	});

	it('reuses the smallest available number after closing a tab', () => {
		const { workspace } = makeWorkspace();
		workspace.addTab();
		workspace.closeTab(1);

		workspace.addTab();

		expect(workspace.activeTab.name).toBe('Untitled 2');
	});

	it('fills gaps in tab numbering', () => {
		const { workspace } = makeWorkspace();
		workspace.addTab();
		workspace.addTab();
		workspace.closeTab(1);

		workspace.addTab();

		expect(workspace.activeTab.name).toBe('Untitled 2');
	});
});

describe('Workspace — shared state propagation', () => {
	it('all tabs share the same SharedState reference', () => {
		const { workspace } = makeWorkspace();
		workspace.addTab();

		workspace.shared.activeTool = 'eraser';

		expect(workspace.tabs[0].shared.activeTool).toBe('eraser');
		expect(workspace.tabs[1].shared.activeTool).toBe('eraser');
	});
});

describe('Workspace — openDocument', () => {
	it('creates a tab from saved data and activates it', () => {
		const { workspace } = makeWorkspace();
		const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);

		workspace.openDocument({
			id: 'saved-doc',
			name: 'My Art',
			width: 2,
			height: 1,
			pixels
		});

		expect(workspace.tabs).toHaveLength(2);
		expect(workspace.activeIndex).toBe(1);
		expect(workspace.activeTab.name).toBe('My Art');
		expect(workspace.activeTab.documentId).toBe('saved-doc');
		expect(workspace.activeTab.pixelCanvas.width).toBe(2);
		expect(workspace.activeTab.pixelCanvas.height).toBe(1);
		expect(workspace.activeTab.pixelCanvas.pixels()).toEqual(pixels);
	});
});

describe('Workspace — hydration', () => {
	it('restores tabs and shared state from a snapshot', () => {
		const pixels = new Uint8Array([255, 0, 0, 255]);
		const restored: WorkspaceSnapshot = {
			tabs: [
				{
					id: 'doc-1',
					name: 'My Sprite',
					width: 1,
					height: 1,
					pixels,
					viewport: {
						pixelSize: 32,
						zoom: 2.0,
						panX: 10,
						panY: 20,
						showGrid: true,
						gridColor: '#ECE5D9'
					}
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

		const { workspace } = makeWorkspace({ restored });

		expect(workspace.tabs).toHaveLength(1);
		expect(workspace.activeTab.name).toBe('My Sprite');
		expect(workspace.activeTab.pixelCanvas.pixels()).toEqual(pixels);
		expect(workspace.shared.activeTool).toBe('eraser');
		expect(workspace.shared.foregroundColor).toEqual({ r: 255, g: 0, b: 0, a: 255 });
		expect(workspace.shared.recentColors).toEqual(['#ff0000']);
	});

	it('new tabs after hydration do not duplicate restored tab numbers', () => {
		const restored: WorkspaceSnapshot = {
			tabs: [
				{
					id: 'doc-1',
					name: 'Untitled 2',
					width: 1,
					height: 1,
					pixels: new Uint8Array([0, 0, 0, 255]),
					viewport: {
						pixelSize: 32,
						zoom: 1.0,
						panX: 0,
						panY: 0,
						showGrid: true,
						gridColor: '#cccccc'
					}
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

		const { workspace } = makeWorkspace({ restored });
		workspace.addTab();

		expect(workspace.tabs[1].name).toBe('Untitled 1');
	});

	it('hydration does NOT emit dirty notifications', () => {
		const restored: WorkspaceSnapshot = {
			tabs: [
				{
					id: 'doc-restored',
					name: 'Restored',
					width: 1,
					height: 1,
					pixels: new Uint8Array([0, 0, 0, 255]),
					viewport: {
						pixelSize: 32,
						zoom: 1.0,
						panX: 0,
						panY: 0,
						showGrid: true,
						gridColor: '#cccccc'
					}
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

		const { notifier } = makeWorkspace({ restored });

		expect(notifier.dirtyCalls).toEqual([]);
		expect(notifier.tabRemovedCalls).toEqual([]);
	});

	it('restores pixelPerfect from a snapshot', () => {
		const restored: WorkspaceSnapshot = {
			tabs: [
				{
					id: 'doc-1',
					name: 'Tab 1',
					width: 1,
					height: 1,
					pixels: new Uint8Array([0, 0, 0, 255]),
					viewport: {
						pixelSize: 32,
						zoom: 1.0,
						panX: 0,
						panY: 0,
						showGrid: true,
						gridColor: '#cccccc'
					}
				}
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: [],
				pixelPerfect: false
			}
		};

		const { workspace } = makeWorkspace({ restored });

		expect(workspace.shared.pixelPerfect).toBe(false);
	});

	it('defaults pixelPerfect to true when absent from a legacy snapshot', () => {
		const restored: WorkspaceSnapshot = {
			tabs: [
				{
					id: 'doc-1',
					name: 'Tab 1',
					width: 1,
					height: 1,
					pixels: new Uint8Array([0, 0, 0, 255]),
					viewport: {
						pixelSize: 32,
						zoom: 1.0,
						panX: 0,
						panY: 0,
						showGrid: true,
						gridColor: '#cccccc'
					}
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

		const { workspace } = makeWorkspace({ restored });

		expect(workspace.shared.pixelPerfect).toBe(true);
	});

	it('clamps an out-of-range activeTabIndex to the last tab', () => {
		const makeTabSnap = (id: string) => ({
			id,
			name: id,
			width: 1,
			height: 1,
			pixels: new Uint8Array([0, 0, 0, 255]),
			viewport: {
				pixelSize: 32,
				zoom: 1.0,
				panX: 0,
				panY: 0,
				showGrid: true,
				gridColor: '#cccccc'
			}
		});
		const restored: WorkspaceSnapshot = {
			tabs: [makeTabSnap('doc-a'), makeTabSnap('doc-b')],
			activeTabIndex: 5,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			}
		};

		const { workspace } = makeWorkspace({ restored });

		expect(workspace.activeIndex).toBe(1);
		expect(workspace.activeTab.name).toBe('doc-b');
	});

	it('clamps a negative activeTabIndex to the first tab', () => {
		const makeTabSnap = (id: string) => ({
			id,
			name: id,
			width: 1,
			height: 1,
			pixels: new Uint8Array([0, 0, 0, 255]),
			viewport: {
				pixelSize: 32,
				zoom: 1.0,
				panX: 0,
				panY: 0,
				showGrid: true,
				gridColor: '#cccccc'
			}
		});
		const restored: WorkspaceSnapshot = {
			tabs: [makeTabSnap('doc-a'), makeTabSnap('doc-b')],
			activeTabIndex: -1,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			}
		};

		const { workspace } = makeWorkspace({ restored });

		expect(workspace.activeIndex).toBe(0);
		expect(workspace.activeTab.name).toBe('doc-a');
	});
});

describe('Workspace — toSnapshot', () => {
	it('captures a single-tab workspace', () => {
		const { workspace } = makeWorkspace({
			initialForegroundColor: { r: 200, g: 50, b: 30, a: 255 },
			gridColor: '#ECE5D9'
		});
		workspace.shared.activeTool = 'line';

		const snapshot: WorkspaceSnapshot = workspace.toSnapshot();

		expect(snapshot.tabs).toHaveLength(1);
		expect(snapshot.activeTabIndex).toBe(0);
		expect(snapshot.tabs[0].id).toBe(workspace.tabs[0].documentId);
		expect(snapshot.tabs[0].name).toBe('Untitled 1');
		expect(snapshot.tabs[0].width).toBe(16);
		expect(snapshot.tabs[0].height).toBe(16);
		expect(snapshot.sharedState.activeTool).toBe('line');
		expect(snapshot.sharedState.foregroundColor).toEqual({ r: 200, g: 50, b: 30, a: 255 });
	});

	it('captures a multi-tab workspace with the correct active index', () => {
		const { workspace } = makeWorkspace({ gridColor: '#ECE5D9' });
		workspace.addTab();
		workspace.setActiveTab(0);

		const snapshot = workspace.toSnapshot();

		expect(snapshot.tabs).toHaveLength(2);
		expect(snapshot.activeTabIndex).toBe(0);
		expect(snapshot.tabs[0].name).toBe('Untitled 1');
		expect(snapshot.tabs[1].name).toBe('Untitled 2');
	});

	it('captures per-tab viewport state', () => {
		const { workspace } = makeWorkspace({ gridColor: '#ECE5D9' });
		workspace.activeTab.viewport = {
			pixelSize: 32,
			zoom: 3.0,
			panX: 100,
			panY: -50,
			showGrid: false,
			gridColor: '#ECE5D9'
		};

		const snapshot = workspace.toSnapshot();

		expect(snapshot.tabs[0].viewport.zoom).toBe(3.0);
		expect(snapshot.tabs[0].viewport.panX).toBe(100);
		expect(snapshot.tabs[0].viewport.showGrid).toBe(false);
	});

	it('captures the pixelPerfect preference', () => {
		const { workspace } = makeWorkspace({ gridColor: '#ECE5D9' });
		workspace.shared.pixelPerfect = false;

		const snapshot = workspace.toSnapshot();

		expect(snapshot.sharedState.pixelPerfect).toBe(false);
	});

	it('snapshot arrays are copies independent from workspace state', () => {
		const { workspace } = makeWorkspace({ gridColor: '#ECE5D9' });

		const snapshot = workspace.toSnapshot();

		expect(snapshot.sharedState.recentColors).not.toBe(workspace.shared.recentColors);
	});
});

describe('Workspace — dirty notifications', () => {
	it('construction emits markDirty for the initial tab', () => {
		const { workspace, notifier } = makeWorkspace();
		expect(notifier.dirtyCalls).toEqual([workspace.tabs[0].documentId]);
	});

	it('addTab emits markDirty for the new tab', () => {
		const { workspace, notifier } = makeWorkspace();
		notifier.reset();

		workspace.addTab();

		expect(notifier.dirtyCalls).toEqual([workspace.tabs[1].documentId]);
	});

	it('openDocument emits markDirty for the opened document id', () => {
		const { workspace, notifier } = makeWorkspace();
		notifier.reset();

		workspace.openDocument({
			id: 'opened-doc',
			name: 'Opened',
			width: 1,
			height: 1,
			pixels: new Uint8Array([0, 0, 0, 255])
		});

		expect(notifier.dirtyCalls).toEqual(['opened-doc']);
	});

	it('closeTab emits notifyTabRemoved with the removed tab documentId', () => {
		const { workspace, notifier } = makeWorkspace();
		workspace.addTab();
		const removedId = workspace.tabs[1].documentId;
		notifier.reset();

		workspace.closeTab(1);

		expect(notifier.tabRemovedCalls).toEqual([removedId]);
	});

	it('closeTab on the last tab does NOT emit notifyTabRemoved', () => {
		const { workspace, notifier } = makeWorkspace();
		notifier.reset();

		workspace.closeTab(0);

		expect(notifier.tabRemovedCalls).toEqual([]);
		expect(workspace.tabs).toHaveLength(1);
	});

	it('setActiveTool emits markDirty for the active tab', () => {
		const { workspace, notifier } = makeWorkspace();
		notifier.reset();

		workspace.setActiveTool('line');

		expect(workspace.shared.activeTool).toBe('line');
		expect(notifier.dirtyCalls).toEqual([workspace.activeTab.documentId]);
	});

	it('setForegroundColor emits markDirty for the active tab', () => {
		const { workspace, notifier } = makeWorkspace();
		notifier.reset();

		workspace.setForegroundColor({ r: 10, g: 20, b: 30, a: 255 });

		expect(workspace.shared.foregroundColor).toEqual({ r: 10, g: 20, b: 30, a: 255 });
		expect(notifier.dirtyCalls).toEqual([workspace.activeTab.documentId]);
	});

	it('setBackgroundColor emits markDirty for the active tab', () => {
		const { workspace, notifier } = makeWorkspace();
		notifier.reset();

		workspace.setBackgroundColor({ r: 200, g: 200, b: 200, a: 255 });

		expect(workspace.shared.backgroundColor).toEqual({ r: 200, g: 200, b: 200, a: 255 });
		expect(notifier.dirtyCalls).toEqual([workspace.activeTab.documentId]);
	});

	it('togglePixelPerfect emits markDirty for the active tab', () => {
		const { workspace, notifier } = makeWorkspace();
		const initial = workspace.shared.pixelPerfect;
		notifier.reset();

		workspace.togglePixelPerfect();

		expect(workspace.shared.pixelPerfect).toBe(!initial);
		expect(notifier.dirtyCalls).toEqual([workspace.activeTab.documentId]);
	});

	it('swapColors emits markDirty for the active tab', () => {
		const { workspace, notifier } = makeWorkspace();
		const fg = workspace.shared.foregroundColor;
		const bg = workspace.shared.backgroundColor;
		notifier.reset();

		workspace.swapColors();

		expect(workspace.shared.foregroundColor).toEqual(bg);
		expect(workspace.shared.backgroundColor).toEqual(fg);
		expect(notifier.dirtyCalls).toEqual([workspace.activeTab.documentId]);
	});

	it('setActiveTab does NOT emit markDirty', () => {
		const { workspace, notifier } = makeWorkspace();
		workspace.addTab();
		notifier.reset();

		workspace.setActiveTab(0);

		expect(notifier.dirtyCalls).toEqual([]);
	});
});
