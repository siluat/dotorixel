import type { Color } from '$lib/canvas/color';
import type { CanvasBackend } from '$lib/canvas/editor-session/canvas-backend';
import { createAutoSaveDirtyNotifier } from '$lib/canvas/editor-session/dirty-notifier';
import { createEditorController } from '$lib/canvas/editor-session/create-editor-controller';
import type { EditorController } from '$lib/canvas/editor-session/editor-controller.svelte';
import { SessionStorage } from './session-storage';
import { SessionPersistence } from './session-persistence';
import { AutoSave } from './auto-save';
import type { SavedDocumentSummary } from './session-storage-types';

/** Handle for controlling session persistence (auto-save, flush, cleanup). */
export interface SessionHandle {
	/**
	 * Mark a document as needing save. Under normal use the EditorController
	 * auto-emits this on every persistable mutation; direct callers are
	 * tests and consumers that need to flush state mutated outside the
	 * controller surface.
	 */
	markDirty(documentId: string): void;
	/**
	 * Notify that a tab was closed. Under normal use the EditorController
	 * auto-emits this via `workspace.closeTab`; direct callers are tests
	 * and orchestration code that closes tabs outside the controller.
	 */
	notifyTabClosed(documentId: string): void;
	/** Immediately persist all pending changes. No-ops when nothing is dirty. */
	flush(): Promise<void>;
	/** Check whether a document has been explicitly saved by the user. */
	isDocumentSaved(documentId: string): Promise<boolean>;
	/** Mark a document as saved with a new name. */
	saveDocumentAs(documentId: string, name: string): Promise<void>;
	/** Remove a document from persistent storage immediately. */
	deleteDocument(documentId: string): Promise<void>;
	/** Return all explicitly saved documents, sorted by most recently modified. */
	getAllSavedDocuments(): Promise<SavedDocumentSummary[]>;
	/** Tear down timers and close the storage connection. */
	dispose(): void;
}

const NO_OP_SESSION: SessionHandle = {
	markDirty() {},
	notifyTabClosed() {},
	async flush() {},
	async isDocumentSaved() { return false; },
	async saveDocumentAs() {},
	async deleteDocument() {},
	async getAllSavedDocuments() { return []; },
	dispose() {}
};

export interface OpenSessionOptions {
	backend: CanvasBackend;
	foregroundColor?: Color;
	gridColor?: string;
	debounceMs?: number;
}

/**
 * Open a session: restore prior workspace from IndexedDB, wire the dirty
 * notifier to AutoSave, and assemble the EditorController. Returns a
 * fresh controller with a no-op session handle if storage is unavailable.
 */
export async function openSession(
	options: OpenSessionOptions
): Promise<{ editor: EditorController; session: SessionHandle }> {
	let storage: SessionStorage | undefined;
	try {
		storage = await SessionStorage.open();
		const persistence = new SessionPersistence(storage);
		const restored = await persistence.restore();

		let editorRef: EditorController | null = null;
		const autoSave = new AutoSave(
			persistence,
			() => {
				if (!editorRef) throw new Error('openSession: editor not yet assigned');
				return editorRef.workspace.toSnapshot();
			},
			options.debounceMs
		);
		const notifier = createAutoSaveDirtyNotifier(autoSave);

		const editor = createEditorController({
			backend: options.backend,
			notifier,
			gridColor: options.gridColor,
			initialForegroundColor: options.foregroundColor,
			restored: restored ?? undefined
		});
		editorRef = editor;

		const session: SessionHandle = {
			markDirty: (docId) => autoSave.markDirty(docId),
			notifyTabClosed: (docId) => autoSave.notifyTabRemoved(docId),
			flush: () => autoSave.flush(),
			isDocumentSaved: (docId) => persistence.isDocumentSaved(docId),
			saveDocumentAs: (docId, name) => persistence.saveDocumentAs(docId, name),
			deleteDocument: (docId) => persistence.deleteDocument(docId),
			getAllSavedDocuments: () => persistence.getAllSavedDocuments(),
			dispose: () => {
				autoSave.dispose();
				storage!.close();
			}
		};

		return { editor, session };
	} catch (error) {
		storage?.close();
		console.warn('Session persistence unavailable, starting with a fresh workspace:', error);
		const editor = createEditorController({
			backend: options.backend,
			notifier: { markDirty() {}, notifyTabRemoved() {} },
			gridColor: options.gridColor,
			initialForegroundColor: options.foregroundColor
		});
		return { editor, session: NO_OP_SESSION };
	}
}
