// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { Workspace } from './workspace.svelte';

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

	it('tab name counter never recycles after closing', () => {
		const workspace = new Workspace();
		workspace.addTab();
		// tabs: [Untitled 1, Untitled 2]
		workspace.closeTab(1);
		// tabs: [Untitled 1]

		workspace.addTab();

		expect(workspace.activeEditor.name).toBe('Untitled 3');
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

	it('forwards gridColor to initial tab', () => {
		const workspace = new Workspace({ gridColor: '#ECE5D9' });

		expect(workspace.activeEditor.viewportState.gridColor).toBe('#ECE5D9');
	});

	it('new tabs also receive the configured gridColor', () => {
		const workspace = new Workspace({ gridColor: '#ECE5D9' });

		workspace.addTab();

		expect(workspace.tabs[1].viewportState.gridColor).toBe('#ECE5D9');
	});
});
