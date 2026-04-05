import { EditorState } from './editor-state.svelte';
import { SharedState } from './shared-state.svelte';

export class Workspace {
	readonly shared: SharedState;
	tabs = $state<EditorState[]>([]);
	activeTabIndex = $state(0);
	#nameCounter = 1;

	get activeEditor(): EditorState {
		return this.tabs[this.activeTabIndex];
	}

	constructor() {
		this.shared = new SharedState();
		this.addTab();
	}

	addTab() {
		const name = `Untitled ${this.#nameCounter++}`;
		const editor = new EditorState({ shared: this.shared, name });
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
