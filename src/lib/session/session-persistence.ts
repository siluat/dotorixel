import type { SessionStorage } from './session-storage';

const DEFAULT_VIEWPORT = {
	pixelSize: 32,
	zoom: 1.0,
	panX: 0,
	panY: 0,
	showGrid: true,
	gridColor: '#cccccc'
} as const;

/**
 * Session's own persistence contract. Structurally compatible with
 * canvas's WorkspaceSnapshot — session never imports that type by name.
 */
export interface PersistableWorkspace {
	readonly tabs: ReadonlyArray<{
		readonly id: string;
		readonly name: string;
		readonly width: number;
		readonly height: number;
		readonly pixels: Uint8Array;
		readonly viewport: {
			readonly pixelSize: number;
			readonly zoom: number;
			readonly panX: number;
			readonly panY: number;
			readonly showGrid: boolean;
			readonly gridColor: string;
		};
	}>;
	readonly activeTabIndex: number;
	readonly sharedState: {
		readonly activeTool: string;
		readonly foregroundColor: { r: number; g: number; b: number; a: number };
		readonly backgroundColor: { r: number; g: number; b: number; a: number };
		readonly recentColors: readonly string[];
	};
}

export class SessionPersistence {
	#storage: SessionStorage;

	constructor(storage: SessionStorage) {
		this.#storage = storage;
	}

	async save(snapshot: PersistableWorkspace, dirtyDocIds?: Set<string>): Promise<void> {
		const oldWs = await this.#storage.getWorkspace();
		const oldDocIds = new Set(oldWs?.tabOrder ?? []);

		const now = new Date();
		const tabOrder: string[] = [];
		const viewports: Record<string, PersistableWorkspace['tabs'][number]['viewport']> = {};

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
		}

		await this.#storage.putWorkspace({
			id: 'current',
			tabOrder,
			activeTabIndex: snapshot.activeTabIndex,
			sharedState: {
				activeTool: snapshot.sharedState.activeTool,
				foregroundColor: { ...snapshot.sharedState.foregroundColor },
				backgroundColor: { ...snapshot.sharedState.backgroundColor },
				recentColors: [...snapshot.sharedState.recentColors]
			},
			viewports
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

	async deleteDocument(id: string): Promise<void> {
		await this.#storage.deleteDocument(id);
	}

	async restore(): Promise<PersistableWorkspace | null> {
		try {
			const ws = await this.#storage.getWorkspace();
			if (!ws) return null;

			const tabs: PersistableWorkspace['tabs'][number][] = [];
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
