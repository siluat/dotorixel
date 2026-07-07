import type {
	WorkspaceSnapshot,
	TabSnapshot,
	LayerSnapshot,
	ReferenceLayerSnapshot
} from '$lib/canvas/workspace-snapshot';
import type { ReferenceImage } from '$lib/reference-images/reference-image-types';
import type { ReferenceWindowState } from '$lib/reference-images/reference-window-state-types';
import { decodeReferenceBlob } from '$lib/reference-images/decode-reference-blob';
import type { SessionStorage } from './session-storage';
import type {
	DisplayStateRecord,
	DocumentRecord,
	LayerRecordV6,
	MarqueeRecord,
	ReferenceImageRecord,
	SavedDocumentSummary,
	SelectionClipboardRecord,
	SharedStateRecord
} from './session-storage-types';

const DEFAULT_VIEWPORT = {
	pixelSize: 32,
	zoom: 1.0,
	panX: 0,
	panY: 0,
	showGrid: true,
	gridColor: '#cccccc',
	showOnionSkin: false
} as const;

function isReferenceLayer(layer: LayerSnapshot): layer is ReferenceLayerSnapshot {
	return 'kind' in layer && layer.kind === 'reference';
}

/**
 * Serializes a snapshot layer into a V6 record. A Pixel Layer carries one Cel per
 * frame, copied through as-is; the Reference Layer is frame-independent.
 */
function serializeLayer(layer: LayerSnapshot): LayerRecordV6 {
	if (isReferenceLayer(layer)) {
		return {
			kind: 'reference',
			id: layer.id,
			name: layer.name,
			visible: layer.visible,
			opacity: layer.opacity,
			sourceBlob: layer.sourceBlob,
			naturalWidth: layer.naturalWidth,
			naturalHeight: layer.naturalHeight,
			placement: { ...layer.placement }
		};
	}
	return {
		kind: 'pixel',
		id: layer.id,
		name: layer.name,
		cels: layer.cels.map((cel) => ({ frameId: cel.frameId, pixels: cel.pixels.slice() })),
		visible: layer.visible,
		opacity: layer.opacity
	};
}

function copyMarquee(marquee: MarqueeRecord | null | undefined): MarqueeRecord | null {
	return marquee ? { ...marquee } : null;
}

function copySelectionClipboard(
	clipboard: SelectionClipboardRecord | null | undefined
): SelectionClipboardRecord | null {
	return clipboard
		? {
				pixels: clipboard.pixels.slice(),
				width: clipboard.width,
				height: clipboard.height
			}
		: null;
}

function copySharedState(sharedState: SharedStateRecord): SharedStateRecord {
	return {
		activeTool: sharedState.activeTool,
		foregroundColor: { ...sharedState.foregroundColor },
		backgroundColor: { ...sharedState.backgroundColor },
		recentColors: [...sharedState.recentColors],
		pixelPerfect: sharedState.pixelPerfect,
		selectionClipboard: copySelectionClipboard(sharedState.selectionClipboard)
	};
}

/**
 * Hydrates a V6 record layer into a snapshot layer. A Pixel Layer carries every
 * Cel through unchanged; the Reference Layer is frame-independent and decodes its
 * source blob into RGBA as before.
 */
async function hydrateLayer(layer: LayerRecordV6): Promise<LayerSnapshot> {
	if (layer.kind === 'pixel') {
		return {
			kind: 'pixel',
			id: layer.id,
			name: layer.name,
			cels: layer.cels.map((cel) => ({ frameId: cel.frameId, pixels: cel.pixels.slice() })),
			visible: layer.visible,
			opacity: layer.opacity
		};
	}
	const decoded = await decodeReferenceBlob(layer.sourceBlob);
	return {
		...layer,
		placement: { ...layer.placement },
		sourceRgba: new Uint8Array(decoded.data)
	};
}

/**
 * Maps a persisted document record to a Tab snapshot, hydrating every layer. The
 * viewport is resolved by the caller: reopening a saved document resets it to
 * DEFAULT_VIEWPORT, while restoring a workspace tab carries its per-tab viewport.
 */
async function recordToTabSnapshot(
	doc: DocumentRecord,
	viewport: TabSnapshot['viewport']
): Promise<TabSnapshot> {
	return {
		id: doc.id,
		name: doc.name,
		width: doc.width,
		height: doc.height,
		marquee: copyMarquee(doc.marquee),
		layers: await Promise.all(doc.layers.map((layer) => hydrateLayer(layer))),
		frames: doc.frames.map((frame) => ({ id: frame.id, durationMs: frame.durationMs })),
		activeFrameId: doc.activeFrameId,
		activeLayerId: doc.activeLayerId,
		nextLayerNumber: doc.nextLayerNumber,
		timelinePanelCollapsed: doc.timelinePanelCollapsed,
		viewport
	};
}

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
					schemaVersion: 7,
					id: tab.id,
					name: tab.name,
					width: tab.width,
					height: tab.height,
					marquee: copyMarquee(tab.marquee),
					frames: tab.frames.map((frame) => ({ id: frame.id, durationMs: frame.durationMs })),
					activeFrameId: tab.activeFrameId,
					layers: tab.layers.map((layer) => serializeLayer(layer)),
					activeLayerId: tab.activeLayerId,
					nextLayerNumber: tab.nextLayerNumber,
					timelinePanelCollapsed: tab.timelinePanelCollapsed,
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
				pixelPerfect: snapshot.sharedState.pixelPerfect,
				selectionClipboard: copySelectionClipboard(snapshot.sharedState.selectionClipboard)
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

	async getSavedDocumentSnapshot(id: string): Promise<TabSnapshot | null> {
		const doc = await this.#storage.getDocument(id);
		if (!doc || !doc.saved) return null;
		// Reopening a saved document resets the viewport.
		return recordToTabSnapshot(doc, DEFAULT_VIEWPORT);
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

				const record = ws.viewports[docId] ?? DEFAULT_VIEWPORT;
				// A viewport record written before the onion-skin flag existed reads as off.
				const viewport = { ...record, showOnionSkin: record.showOnionSkin ?? false };

				tabs.push(await recordToTabSnapshot(doc, viewport));
			}

			if (tabs.length === 0) return null;

			const references: Record<string, ReferenceImage[]> = {};
			if (ws.references) {
				for (const [docId, refs] of Object.entries(ws.references)) {
					references[docId] = refs.map((r) => ({ ...r }));
				}
			}

			const displayStates: Record<string, ReferenceWindowState[]> = {};
			if (ws.displayStates) {
				for (const [docId, states] of Object.entries(ws.displayStates)) {
					displayStates[docId] = states.map((s) => ({ ...s }));
				}
			}

			return {
				tabs,
				activeTabIndex: Math.min(ws.activeTabIndex, tabs.length - 1),
				sharedState: copySharedState(ws.sharedState),
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
