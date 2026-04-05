import { EditorState } from './editor-state.svelte';
import { SharedState } from './shared-state.svelte';
import type { Color } from './color';
import type { WorkspaceInit } from '$lib/session/workspace-init-types';
import { WasmPixelCanvas, WasmViewport } from '$wasm/dotorixel_wasm';

export interface WorkspaceOptions {
	foregroundColor?: Color;
	gridColor?: string;
	init?: WorkspaceInit;
}

const UNTITLED_PATTERN = /^Untitled (\d+)$/;

export class Workspace {
	readonly shared: SharedState;
	tabs = $state<EditorState[]>([]);
	activeTabIndex = $state(0);
	#gridColor?: string;

	get activeEditor(): EditorState {
		return this.tabs[this.activeTabIndex];
	}

	constructor(options: WorkspaceOptions = {}) {
		this.shared = new SharedState();
		this.#gridColor = options.gridColor;

		if (options.init) {
			this.#initFromSaved(options.init);
		} else {
			if (options.foregroundColor) {
				this.shared.foregroundColor = options.foregroundColor;
			}
			this.addTab();
		}
	}

	#initFromSaved(init: WorkspaceInit) {
		this.shared.activeTool = init.sharedState.activeTool;
		this.shared.foregroundColor = init.sharedState.foregroundColor;
		this.shared.backgroundColor = init.sharedState.backgroundColor;
		this.shared.recentColors = init.sharedState.recentColors;

		for (const tab of init.tabs) {
			const pixelCanvas = WasmPixelCanvas.from_pixels(tab.width, tab.height, tab.pixels);
			const viewport = new WasmViewport(
				tab.viewport.pixelSize,
				tab.viewport.zoom,
				tab.viewport.panX,
				tab.viewport.panY
			);
			const editor = new EditorState({
				shared: this.shared,
				name: tab.name,
				pixelCanvas,
				viewportState: {
					viewport,
					showGrid: tab.viewport.showGrid,
					gridColor: tab.viewport.gridColor
				}
			});
			this.tabs.push(editor);
		}

		this.activeTabIndex = init.activeTabIndex;
	}

	addTab() {
		const name = this.#nextUntitledName();
		const editor = new EditorState({ shared: this.shared, name, gridColor: this.#gridColor });
		this.tabs.push(editor);
		this.activeTabIndex = this.tabs.length - 1;
	}

	#nextUntitledName(): string {
		const usedNumbers = new Set<number>();
		for (const tab of this.tabs) {
			const match = tab.name.match(UNTITLED_PATTERN);
			if (match) {
				usedNumbers.add(parseInt(match[1], 10));
			}
		}
		let nextNumber = 1;
		while (usedNumbers.has(nextNumber)) nextNumber++;
		return `Untitled ${nextNumber}`;
	}

	closeTab(index: number) {
		if (this.tabs.length <= 1) return;

		this.tabs.splice(index, 1);

		if (index === this.activeTabIndex) {
			this.activeTabIndex = Math.min(index, this.tabs.length - 1);
		} else if (index < this.activeTabIndex) {
			this.activeTabIndex--;
		}
	}

	setActiveTab(index: number) {
		this.activeTabIndex = index;
	}
}
