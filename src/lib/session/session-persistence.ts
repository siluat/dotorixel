import type { SessionStorage } from './session-storage';
import type { DocumentRecord, WorkspaceRecord } from './session-storage-types';
import type { WorkspaceInit, TabInit, ViewportInit } from './workspace-init-types';
import type { Workspace } from '$lib/canvas/workspace.svelte';

const DEFAULT_VIEWPORT: ViewportInit = {
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

	async save(workspace: Workspace): Promise<void> {
		const oldWs = await this.#storage.getWorkspace();
		const oldDocIds = oldWs?.tabOrder ?? [];

		const editor = workspace.activeEditor;
		const docId = `doc-${Date.now()}`;
		const now = new Date();

		const doc: DocumentRecord = {
			id: docId,
			name: editor.name,
			width: editor.pixelCanvas.width,
			height: editor.pixelCanvas.height,
			pixels: editor.pixelCanvas.pixels(),
			createdAt: now,
			updatedAt: now
		};

		const ws: WorkspaceRecord = {
			id: 'current',
			tabOrder: [docId],
			activeTabIndex: 0,
			sharedState: {
				activeTool: editor.activeTool,
				foregroundColor: { ...editor.foregroundColor },
				backgroundColor: { ...editor.backgroundColor },
				recentColors: [...editor.recentColors]
			},
			viewports: {
				[docId]: {
					pixelSize: editor.viewportState.viewport.pixel_size,
					zoom: editor.viewportState.viewport.zoom,
					panX: editor.viewportState.viewport.pan_x,
					panY: editor.viewportState.viewport.pan_y,
					showGrid: editor.viewportState.showGrid,
					gridColor: editor.viewportState.gridColor
				}
			}
		};

		await this.#storage.putDocument(doc);
		await this.#storage.putWorkspace(ws);

		for (const oldId of oldDocIds) {
			if (oldId !== docId) {
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
