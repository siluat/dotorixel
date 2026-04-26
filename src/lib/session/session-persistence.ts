import type { WorkspaceSnapshot, TabSnapshot } from '$lib/canvas/workspace-snapshot';
import type { ReferenceImage } from '$lib/reference-images/reference-image-types';
import type { DisplayState } from '$lib/reference-images/display-state-types';
import type { SessionStorage } from './session-storage';
import type {
	DisplayStateRecord,
	ReferenceImageRecord,
	SavedDocumentSummary
} from './session-storage-types';

const DEFAULT_VIEWPORT = {
	pixelSize: 32,
	zoom: 1.0,
	panX: 0,
	panY: 0,
	showGrid: true,
	gridColor: '#cccccc'
} as const;

export class SessionPersistence {
	#storage: SessionStorage;

	constructor(storage: SessionStorage) {
		this.#storage = storage;
	}

	async save(snapshot: WorkspaceSnapshot, dirtyDocIds?: Set<string>): Promise<void> {
		const oldWs = await this.#storage.getWorkspace();
		const oldDocIds = new Set(oldWs?.tabOrder ?? []);

		const now = new Date();
		const tabOrder: string[] = [];
		const viewports: Record<string, TabSnapshot['viewport']> = {};
		const references: Record<string, ReferenceImageRecord[]> = {};
		const displayStates: Record<string, DisplayStateRecord[]> = {};

		for (const tab of snapshot.tabs) {
			tabOrder.push(tab.id);

			const shouldWrite = !dirtyDocIds || dirtyDocIds.has(tab.id);
			if (shouldWrite) {
				const existing = await this.#storage.getDocument(tab.id);
				await this.#storage.putDocument({
					schemaVersion: 2,
					id: tab.id,
					name: tab.name,
					width: tab.width,
					height: tab.height,
					pixels: tab.pixels,
					saved: existing?.saved ?? false,
					createdAt: existing?.createdAt ?? now,
					updatedAt: now
				});
			}

			viewports[tab.id] = { ...tab.viewport };

			const refs = snapshot.references?.[tab.id];
			if (refs && refs.length > 0) {
				references[tab.id] = refs.map((r) => ({ ...r }));
			}

			const states = snapshot.displayStates?.[tab.id];
			if (states && states.length > 0) {
				displayStates[tab.id] = states.map((s) => ({ ...s }));
			}
		}

		await this.#storage.putWorkspace({
			id: 'current',
			tabOrder,
			activeTabIndex: snapshot.activeTabIndex,
			sharedState: {
				activeTool: snapshot.sharedState.activeTool,
				foregroundColor: { ...snapshot.sharedState.foregroundColor },
				backgroundColor: { ...snapshot.sharedState.backgroundColor },
				recentColors: [...snapshot.sharedState.recentColors],
				pixelPerfect: snapshot.sharedState.pixelPerfect
			},
			viewports,
			references,
			displayStates
		});

		// Delete unsaved documents that are no longer in any tab
		const currentDocIds = new Set(tabOrder);
		for (const oldId of oldDocIds) {
			if (!currentDocIds.has(oldId)) {
				const doc = await this.#storage.getDocument(oldId);
				if (doc && !doc.saved) {
					await this.#storage.deleteDocument(oldId);
				}
			}
		}
	}

	async isDocumentSaved(id: string): Promise<boolean> {
		const doc = await this.#storage.getDocument(id);
		return doc?.saved ?? false;
	}

	async saveDocumentAs(id: string, name: string): Promise<void> {
		const doc = await this.#storage.getDocument(id);
		if (!doc) return;
		await this.#storage.putDocument({ ...doc, saved: true, name });
	}

	async getAllSavedDocuments(): Promise<SavedDocumentSummary[]> {
		return this.#storage.getAllSavedDocuments();
	}

	async deleteDocument(id: string): Promise<void> {
		await this.#storage.deleteDocument(id);
	}

	async restore(): Promise<WorkspaceSnapshot | null> {
		try {
			const ws = await this.#storage.getWorkspace();
			if (!ws) return null;

			const tabs: TabSnapshot[] = [];
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

			const references: Record<string, ReferenceImage[]> = {};
			if (ws.references) {
				for (const [docId, refs] of Object.entries(ws.references)) {
					references[docId] = refs.map((r) => ({ ...r }));
				}
			}

			const displayStates: Record<string, DisplayState[]> = {};
			if (ws.displayStates) {
				for (const [docId, states] of Object.entries(ws.displayStates)) {
					displayStates[docId] = states.map((s) => ({ ...s }));
				}
			}

			return {
				tabs,
				activeTabIndex: Math.min(ws.activeTabIndex, tabs.length - 1),
				sharedState: ws.sharedState,
				references,
				displayStates
			};
		} catch {
			// Corrupted or unreadable data should not block the editor —
			// fall back to a blank canvas so the user can keep working.
			return null;
		}
	}
}
