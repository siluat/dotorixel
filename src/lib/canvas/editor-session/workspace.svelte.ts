import type { Color } from '../color';
import type { PixelCanvas, ResizeAnchor } from '../canvas-model';
import type { ViewportData } from '../viewport';
import type { ToolType } from '../tool-registry';
import { isValidToolType } from '../tool-registry';
import { SharedState } from '../shared-state.svelte';
import type { WorkspaceSnapshot, TabSnapshot } from '../workspace-snapshot';
import type { CanvasBackend } from './canvas-backend';
import type { DirtyNotifier } from './dirty-notifier';
import { TabState } from './tab-state.svelte';

const UNTITLED_PATTERN = /^Untitled (\d+)$/;

export interface WorkspaceDeps {
	readonly backend: CanvasBackend;
	readonly notifier: DirtyNotifier;
	readonly keyboard: { readonly getShiftHeld: () => boolean };
	readonly gridColor?: string;
	readonly restored?: WorkspaceSnapshot;
	readonly initialForegroundColor?: Color;
}

/**
 * Config passed to `createTab` / `addTab` callers. `createTab` bakes in the
 * workspace's ambient deps (backend, shared, keyboard, notifier) so callers
 * only need to describe the document.
 */
export interface CreateTabConfig {
	readonly documentId?: string;
	readonly name?: string;
	readonly pixelCanvas?: PixelCanvas;
	readonly viewport?: ViewportData;
	readonly canvasWidth?: number;
	readonly canvasHeight?: number;
}

export interface OpenDocumentInput {
	readonly id: string;
	readonly name: string;
	readonly width: number;
	readonly height: number;
	readonly pixels: Uint8Array;
}

/**
 * Workspace owns the tab collection, the single `SharedState` instance, and
 * the two editor-session ports (`CanvasBackend`, `DirtyNotifier`). All tabs
 * see the same `SharedState` by reference — mutating it is immediately
 * visible everywhere.
 *
 * Auto-emits `DirtyNotifier` calls on tab lifecycle events (`addTab`,
 * `openDocument`, `closeTab`) and on shared-state setter methods
 * (`setActiveTool`, `setForegroundColor`, `setBackgroundColor`,
 * `togglePixelPerfect`, `swapColors`). Hydration from a saved snapshot does
 * NOT emit — restoring is not a user mutation.
 */
export class Workspace {
	readonly shared: SharedState;
	tabs = $state<TabState[]>([]);
	activeIndex = $state(0);

	#backend: CanvasBackend;
	#notifier: DirtyNotifier;
	#keyboard: { readonly getShiftHeld: () => boolean };
	#gridColor?: string;

	get activeTab(): TabState {
		return this.tabs[this.activeIndex];
	}

	constructor(deps: WorkspaceDeps) {
		this.#backend = deps.backend;
		this.#notifier = deps.notifier;
		this.#keyboard = deps.keyboard;
		this.#gridColor = deps.gridColor;
		this.shared = new SharedState();

		if (deps.restored) {
			this.#hydrate(deps.restored);
		} else {
			if (deps.initialForegroundColor) {
				this.shared.foregroundColor = deps.initialForegroundColor;
			}
			this.addTab();
		}
	}

	/**
	 * Construct a `TabState` with the workspace's ambient deps baked in.
	 * Does NOT insert it into `tabs` or emit dirty — `addTab` / `openDocument`
	 * handle the lifecycle side. Exposed so restore hydration can build tabs
	 * without duplicating the dep-injection boilerplate.
	 */
	createTab(config: CreateTabConfig = {}): TabState {
		const documentId = config.documentId ?? `doc-${crypto.randomUUID()}`;
		const name = config.name ?? this.#nextUntitledName();
		return new TabState({
			backend: this.#backend,
			shared: this.shared,
			keyboard: this.#keyboard,
			notifier: this.#notifier,
			documentId,
			name,
			pixelCanvas: config.pixelCanvas,
			viewport: config.viewport,
			canvasWidth: config.canvasWidth,
			canvasHeight: config.canvasHeight,
			gridColor: this.#gridColor
		});
	}

	addTab(): TabState {
		const tab = this.createTab();
		this.tabs.push(tab);
		this.activeIndex = this.tabs.length - 1;
		this.#notifier.markDirty(tab.documentId);
		return tab;
	}

	openDocument(doc: OpenDocumentInput): TabState {
		const pixelCanvas = this.#backend.canvasFactory.fromPixels(doc.width, doc.height, doc.pixels);
		const tab = this.createTab({
			documentId: doc.id,
			name: doc.name,
			pixelCanvas
		});
		this.tabs.push(tab);
		this.activeIndex = this.tabs.length - 1;
		this.#notifier.markDirty(tab.documentId);
		return tab;
	}

	closeTab(index: number): void {
		if (this.tabs.length <= 1) return;
		const removed = this.tabs[index];
		this.tabs.splice(index, 1);
		if (index === this.activeIndex) {
			this.activeIndex = Math.min(index, this.tabs.length - 1);
		} else if (index < this.activeIndex) {
			this.activeIndex--;
		}
		this.#notifier.notifyTabRemoved(removed.documentId);
	}

	setActiveTab(index: number): void {
		this.activeIndex = index;
	}

	setActiveTool(tool: ToolType): void {
		this.shared.activeTool = tool;
		this.#notifier.markDirty(this.activeTab.documentId);
	}

	setForegroundColor(color: Color): void {
		this.shared.foregroundColor = color;
		this.#notifier.markDirty(this.activeTab.documentId);
	}

	setBackgroundColor(color: Color): void {
		this.shared.backgroundColor = color;
		this.#notifier.markDirty(this.activeTab.documentId);
	}

	togglePixelPerfect(): void {
		this.shared.pixelPerfect = !this.shared.pixelPerfect;
		this.#notifier.markDirty(this.activeTab.documentId);
	}

	swapColors(): void {
		const temp = this.shared.foregroundColor;
		this.shared.foregroundColor = this.shared.backgroundColor;
		this.shared.backgroundColor = temp;
		this.#notifier.markDirty(this.activeTab.documentId);
	}

	setActiveResizeAnchor(anchor: ResizeAnchor): void {
		// Resize anchor is a transient per-tab UI parameter; not persistable.
		this.activeTab.resizeAnchor = anchor;
	}

	toSnapshot(): WorkspaceSnapshot {
		return {
			tabs: this.tabs.map((tab): TabSnapshot => tab.toSnapshot()),
			activeTabIndex: this.activeIndex,
			sharedState: {
				activeTool: this.shared.activeTool,
				foregroundColor: { ...this.shared.foregroundColor },
				backgroundColor: { ...this.shared.backgroundColor },
				recentColors: [...this.shared.recentColors],
				pixelPerfect: this.shared.pixelPerfect
			}
		};
	}

	#hydrate(snapshot: WorkspaceSnapshot): void {
		const tool = snapshot.sharedState.activeTool;
		this.shared.activeTool = isValidToolType(tool) ? tool : 'pencil';
		this.shared.foregroundColor = { ...snapshot.sharedState.foregroundColor };
		this.shared.backgroundColor = { ...snapshot.sharedState.backgroundColor };
		this.shared.recentColors = [...snapshot.sharedState.recentColors];
		this.shared.pixelPerfect = snapshot.sharedState.pixelPerfect ?? true;

		for (const tabSnap of snapshot.tabs) {
			const pixelCanvas = this.#backend.canvasFactory.fromPixels(
				tabSnap.width,
				tabSnap.height,
				tabSnap.pixels
			);
			const tab = this.createTab({
				documentId: tabSnap.id,
				name: tabSnap.name,
				pixelCanvas,
				viewport: tabSnap.viewport
			});
			this.tabs.push(tab);
		}

		this.activeIndex = snapshot.activeTabIndex;
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
}
