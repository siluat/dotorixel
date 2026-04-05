import { EditorState } from './editor-state.svelte';
import { SharedState } from './shared-state.svelte';
import type { Color } from './color';

export interface WorkspaceOptions {
	foregroundColor?: Color;
	gridColor?: string;
}

export class Workspace {
	readonly shared: SharedState;
	tabs = $state<EditorState[]>([]);
	activeTabIndex = $state(0);
	#nameCounter = 1;
	#gridColor?: string;

	get activeEditor(): EditorState {
		return this.tabs[this.activeTabIndex];
	}

	constructor(options: WorkspaceOptions = {}) {
		this.shared = new SharedState();
		if (options.foregroundColor) {
			this.shared.foregroundColor = options.foregroundColor;
		}
		this.#gridColor = options.gridColor;
		this.addTab();
	}

	addTab() {
		const name = `Untitled ${this.#nameCounter++}`;
		const editor = new EditorState({ shared: this.shared, name, gridColor: this.#gridColor });
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
}
