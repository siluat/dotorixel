import { EditorState } from './editor-state.svelte';
import { SharedState } from './shared-state.svelte';
import type { Color } from './color';
import { isValidToolType } from './tool-registry';
import type { WorkspaceSnapshot, TabSnapshot } from './workspace-snapshot';
import { canvasFactory } from './wasm-backend';

export interface WorkspaceOptions {
	foregroundColor?: Color;
	gridColor?: string;
	restored?: WorkspaceSnapshot;
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

		if (options.restored) {
			this.#hydrate(options.restored);
		} else {
			if (options.foregroundColor) {
				this.shared.foregroundColor = options.foregroundColor;
			}
			this.addTab();
		}
	}

	#hydrate(snapshot: WorkspaceSnapshot) {
		const tool = snapshot.sharedState.activeTool;
		this.shared.activeTool = isValidToolType(tool) ? tool : 'pencil';
		this.shared.foregroundColor = snapshot.sharedState.foregroundColor;
		this.shared.backgroundColor = snapshot.sharedState.backgroundColor;
		this.shared.recentColors = [...snapshot.sharedState.recentColors];

		for (const tab of snapshot.tabs) {
			const pixelCanvas = canvasFactory.fromPixels(tab.width, tab.height, tab.pixels);
			const editor = new EditorState({
				shared: this.shared,
				name: tab.name,
				documentId: tab.id,
				pixelCanvas,
				viewport: tab.viewport
			});
			this.tabs.push(editor);
		}

		this.activeTabIndex = snapshot.activeTabIndex;
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

	openDocument(doc: { id: string; name: string; width: number; height: number; pixels: Uint8Array }) {
		const pixelCanvas = canvasFactory.fromPixels(doc.width, doc.height, doc.pixels);
		const editor = new EditorState({
			shared: this.shared,
			name: doc.name,
			documentId: doc.id,
			pixelCanvas,
			gridColor: this.#gridColor
		});
		this.tabs.push(editor);
		this.activeTabIndex = this.tabs.length - 1;
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

	/** Extract a persistence-ready snapshot. No reactive state escapes. */
	toSnapshot(): WorkspaceSnapshot {
		const active = this.activeEditor;
		return {
			tabs: this.tabs.map((editor): TabSnapshot => ({
				id: editor.documentId,
				name: editor.name,
				width: editor.pixelCanvas.width,
				height: editor.pixelCanvas.height,
				pixels: editor.pixelCanvas.pixels(),
				viewport: { ...editor.viewport }
			})),
			activeTabIndex: this.activeTabIndex,
			sharedState: {
				activeTool: active.activeTool,
				foregroundColor: { ...active.foregroundColor },
				backgroundColor: { ...active.backgroundColor },
				recentColors: [...active.recentColors]
			}
		};
	}
}
