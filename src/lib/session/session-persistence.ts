import type { SessionStorage } from './session-storage';
import type { WorkspaceRecord } from './session-storage-types';
import type { WorkspaceInit, TabInit } from './workspace-init-types';
import type { Workspace } from '$lib/canvas/workspace.svelte';
import { extractViewportData, type ViewportData } from '$lib/canvas/viewport';

const DEFAULT_VIEWPORT: ViewportData = {
	pixelSize: 32,
	zoom: 1.0,
	panX: 0,
	panY: 0,
	showGrid: true,
	gridColor: '#cccccc'
};

export class SessionPersistence {
	#storage: SessionStorage;

	constructor(storage: SessionStorage) {
		this.#storage = storage;
	}

	async save(workspace: Workspace, dirtyDocIds?: Set<string>): Promise<void> {
		const oldWs = await this.#storage.getWorkspace();
		const oldDocIds = new Set(oldWs?.tabOrder ?? []);

		const now = new Date();
		const tabOrder: string[] = [];
		const viewports: Record<string, ViewportData> = {};

		for (const editor of workspace.tabs) {
			const docId = editor.documentId;
			tabOrder.push(docId);

			const shouldWrite = !dirtyDocIds || dirtyDocIds.has(docId);
			if (shouldWrite) {
				await this.#storage.putDocument({
					id: docId,
					name: editor.name,
					width: editor.pixelCanvas.width,
					height: editor.pixelCanvas.height,
					pixels: editor.pixelCanvas.pixels(),
					createdAt: now,
					updatedAt: now
				});
			}

			viewports[docId] = extractViewportData(editor.viewportState);
		}

		const active = workspace.activeEditor;
		await this.#storage.putWorkspace({
			id: 'current',
			tabOrder,
			activeTabIndex: workspace.activeTabIndex,
			sharedState: {
				activeTool: active.activeTool,
				foregroundColor: { ...active.foregroundColor },
				backgroundColor: { ...active.backgroundColor },
				recentColors: [...active.recentColors]
			},
			viewports
		});

		// Delete documents that are no longer in the tab list
		const currentDocIds = new Set(tabOrder);
		for (const oldId of oldDocIds) {
			if (!currentDocIds.has(oldId)) {
				await this.#storage.deleteDocument(oldId);
			}
		}
	}

	async restore(): Promise<WorkspaceInit | null> {
		try {
			const ws = await this.#storage.getWorkspace();
			if (!ws) return null;

			const tabs: TabInit[] = [];
			for (const docId of ws.tabOrder) {
				const doc = await this.#storage.getDocument(docId);
				if (!doc) return null;

				const viewport = ws.viewports[docId] ?? DEFAULT_VIEWPORT;

				tabs.push({
					id: doc.id,
					name: doc.name,
					width: doc.width,
					height: doc.height,
					pixels: doc.pixels,
					viewport
				});
			}

			if (tabs.length === 0) return null;

			return {
				tabs,
				activeTabIndex: Math.min(ws.activeTabIndex, tabs.length - 1),
				sharedState: ws.sharedState
			};
		} catch {
			// Corrupted or unreadable data should not block the editor —
			// fall back to a blank canvas so the user can keep working.
			return null;
		}
	}
}
