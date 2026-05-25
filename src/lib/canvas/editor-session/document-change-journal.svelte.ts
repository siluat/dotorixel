import type { Document } from '../canvas-model';

export type UndoableDocumentIntent = { readonly type: 'add-pixel-layer'; readonly name: string };

export type DocumentChange =
	| { readonly kind: 'undoable-document'; readonly intent: UndoableDocumentIntent };

export type DocumentChangeResult =
	| { readonly changed: false }
	| { readonly changed: true; readonly layerId?: string };

export interface DocumentChangeJournalDeps {
	readonly getDocument: () => Document;
	readonly captureUndoSnapshot: () => void;
	readonly createLayerId?: () => string;
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
		}
	}

	#commitUndoableDocument(intent: UndoableDocumentIntent): DocumentChangeResult {
		this.#deps.captureUndoSnapshot();
		const result = this.#applyUndoableDocumentIntent(intent);
		this.#afterDocumentChanged();
		return result;
	}

	#applyUndoableDocumentIntent(intent: UndoableDocumentIntent): DocumentChangeResult {
		switch (intent.type) {
			case 'add-pixel-layer': {
				const layerId = this.#deps.createLayerId?.() ?? crypto.randomUUID();
				this.#deps.getDocument().add_layer(layerId, intent.name);
				return { changed: true, layerId };
			}
		}
	}

	#afterDocumentChanged(): void {
		this.#deps.syncDocumentMetrics();
		this.#deps.reclampViewport();
		this.#deps.invalidateRender();
		this.#deps.markDirty();
	}
}
