import type { Document, ReferencePlacement, ResizeAnchor } from '../canvas-model';

export interface ReferenceLayerSource {
	readonly name: string;
	readonly sourceBlob: Blob;
	readonly sourceRgba: Uint8Array | Uint8ClampedArray;
	readonly naturalWidth: number;
	readonly naturalHeight: number;
}

export type UndoableDocumentIntent =
	| { readonly type: 'add-pixel-layer'; readonly name: string }
	| { readonly type: 'set-reference-layer'; readonly source: ReferenceLayerSource }
	| { readonly type: 'remove-layer'; readonly id: string }
	| { readonly type: 'reorder-layer'; readonly id: string; readonly newVisualIndex: number }
	| { readonly type: 'set-layer-visibility'; readonly id: string; readonly visible: boolean }
	| {
			readonly type: 'set-reference-placement';
			readonly id: string;
			readonly placement: ReferencePlacement;
	  }
	| {
			readonly type: 'resize-document';
			readonly width: number;
			readonly height: number;
			readonly anchor: ResizeAnchor;
	  };

export type PersistedDocumentUiIntent =
	| { readonly type: 'set-active-layer'; readonly id: string }
	| { readonly type: 'set-timeline-panel-collapsed'; readonly collapsed: boolean };

export type DocumentChange =
	| { readonly kind: 'undoable-document'; readonly intent: UndoableDocumentIntent }
	| { readonly kind: 'persisted-document-ui'; readonly intent: PersistedDocumentUiIntent };

export type DocumentChangeResult =
	| { readonly changed: false }
	| { readonly changed: true; readonly layerId?: string };

export interface DocumentChangeJournalDeps {
	readonly getDocument: () => Document;
	readonly captureUndoSnapshot: () => void;
	readonly createLayerId?: () => string;
	readonly rememberReferenceLayerBlob: (layerId: string, sourceBlob: Blob) => void;
	readonly resizeDocument: (
		document: Document,
		width: number,
		height: number,
		anchor: ResizeAnchor
	) => void;
	readonly syncDocumentMetrics: () => void;
	readonly reclampViewport: () => void;
	readonly invalidateRender: () => void;
	readonly markDirty: () => void;
}

/**
 * Applies classified web-shell changes to a tab's active Document and owns the
 * shell-side follow-up sequence around the Rust core Document.
 */
export class DocumentChangeJournal {
	#deps: DocumentChangeJournalDeps;

	constructor(deps: DocumentChangeJournalDeps) {
		this.#deps = deps;
	}

	commit(change: DocumentChange): DocumentChangeResult {
		switch (change.kind) {
			case 'undoable-document':
				return this.#commitUndoableDocument(change.intent);
			case 'persisted-document-ui':
				return this.#commitPersistedDocumentUi(change.intent);
		}
	}

	#commitUndoableDocument(intent: UndoableDocumentIntent): DocumentChangeResult {
		if (!this.#willChangeUndoableDocument(intent)) return { changed: false };
		this.#deps.captureUndoSnapshot();
		const result = this.#applyUndoableDocumentIntent(intent);
		this.#afterUndoableDocumentChanged(intent);
		return result;
	}

	#applyUndoableDocumentIntent(intent: UndoableDocumentIntent): DocumentChangeResult {
		const document = this.#deps.getDocument();
		switch (intent.type) {
			case 'add-pixel-layer': {
				const layerId = this.#deps.createLayerId?.() ?? crypto.randomUUID();
				document.add_layer(layerId, intent.name);
				return { changed: true, layerId };
			}
			case 'set-reference-layer': {
				const layerId = this.#deps.createLayerId?.() ?? crypto.randomUUID();
				document.add_reference_layer(
					layerId,
					intent.source.name,
					new Uint8Array(intent.source.sourceRgba),
					intent.source.naturalWidth,
					intent.source.naturalHeight
				);
				this.#deps.rememberReferenceLayerBlob(layerId, intent.source.sourceBlob);
				return { changed: true, layerId };
			}
			case 'remove-layer':
				document.remove_layer(intent.id);
				return { changed: true };
			case 'reorder-layer':
				document.reorder_layer(intent.id, this.#effectiveReorderStackIndex(intent));
				return { changed: true };
			case 'set-layer-visibility':
				document.set_layer_visibility(intent.id, intent.visible);
				return { changed: true };
			case 'set-reference-placement':
				document.set_reference_placement(
					intent.id,
					intent.placement.x,
					intent.placement.y,
					intent.placement.scale
				);
				return { changed: true };
			case 'resize-document':
				this.#deps.resizeDocument(document, intent.width, intent.height, intent.anchor);
				return { changed: true };
		}
	}

	#commitPersistedDocumentUi(intent: PersistedDocumentUiIntent): DocumentChangeResult {
		if (!this.#willChangePersistedDocumentUi(intent)) return { changed: false };
		const document = this.#deps.getDocument();
		switch (intent.type) {
			case 'set-active-layer':
				document.set_active_layer(intent.id);
				break;
			case 'set-timeline-panel-collapsed':
				document.set_timeline_panel_collapsed(intent.collapsed);
				break;
		}
		this.#afterPersistedDocumentUiChanged(intent);
		return { changed: true };
	}

	#willChangeUndoableDocument(intent: UndoableDocumentIntent): boolean {
		const document = this.#deps.getDocument();
		switch (intent.type) {
			case 'add-pixel-layer':
				return true;
			case 'set-reference-layer':
				this.#assertValidReferenceLayerSource(intent.source);
				return true;
			case 'remove-layer':
				return document.layer_count() > 1;
			case 'reorder-layer': {
				const currentStackIdx = this.#stackIndexOf(intent.id);
				if (document.layer_kind_at(currentStackIdx) === 'reference') return false;
				return currentStackIdx !== this.#effectiveReorderStackIndex(intent);
			}
			case 'set-layer-visibility': {
				const current = document.layer_visible_at(this.#stackIndexOf(intent.id));
				return current !== intent.visible;
			}
			case 'set-reference-placement': {
				const current = document.layer_placement_at(this.#stackIndexOf(intent.id));
				if (!current) {
					throw new Error(`Layer with id ${intent.id} is not a Reference Layer`);
				}
				return (
					current.x !== intent.placement.x ||
					current.y !== intent.placement.y ||
					current.scale !== intent.placement.scale
				);
			}
			case 'resize-document':
				return intent.width !== document.width || intent.height !== document.height;
		}
	}

	#willChangePersistedDocumentUi(intent: PersistedDocumentUiIntent): boolean {
		const document = this.#deps.getDocument();
		switch (intent.type) {
			case 'set-active-layer':
				return document.active_layer_id() !== intent.id;
			case 'set-timeline-panel-collapsed':
				return document.is_timeline_panel_collapsed() !== intent.collapsed;
		}
	}

	#effectiveReorderStackIndex(
		intent: Extract<UndoableDocumentIntent, { type: 'reorder-layer' }>
	): number {
		const document = this.#deps.getDocument();
		const targetStackIdx = document.layer_count() - 1 - intent.newVisualIndex;
		return document.layer_kind_at(0) === 'reference'
			? Math.max(1, targetStackIdx)
			: targetStackIdx;
	}

	#stackIndexOf(id: string): number {
		const document = this.#deps.getDocument();
		const count = document.layer_count();
		for (let i = 0; i < count; i++) {
			if (document.layer_id_at(i) === id) return i;
		}
		throw new Error(`Layer with id ${id} not found`);
	}

	#assertValidReferenceLayerSource(source: ReferenceLayerSource): void {
		if (source.naturalWidth <= 0 || source.naturalHeight <= 0) {
			throw new Error('Reference Layer source dimensions must be positive');
		}
		if (source.sourceRgba.length !== source.naturalWidth * source.naturalHeight * 4) {
			throw new Error('Reference Layer source RGBA length must match dimensions');
		}
	}

	#afterUndoableDocumentChanged(intent: UndoableDocumentIntent): void {
		switch (intent.type) {
			case 'reorder-layer':
				this.#invalidateRenderAndMarkDirty();
				break;
			case 'resize-document':
				this.#deps.syncDocumentMetrics();
				this.#reclampViewportInvalidateRenderAndMarkDirty();
				break;
			case 'add-pixel-layer':
			case 'set-reference-layer':
			case 'remove-layer':
			case 'set-layer-visibility':
			case 'set-reference-placement':
				this.#reclampViewportInvalidateRenderAndMarkDirty();
				break;
		}
	}

	#afterPersistedDocumentUiChanged(intent: PersistedDocumentUiIntent): void {
		switch (intent.type) {
			case 'set-active-layer':
				this.#reclampViewportInvalidateRenderAndMarkDirty();
				break;
			case 'set-timeline-panel-collapsed':
				this.#invalidateRenderAndMarkDirty();
				break;
		}
	}

	#reclampViewportInvalidateRenderAndMarkDirty(): void {
		this.#deps.reclampViewport();
		this.#invalidateRenderAndMarkDirty();
	}

	#invalidateRenderAndMarkDirty(): void {
		this.#deps.invalidateRender();
		this.#deps.markDirty();
	}
}
