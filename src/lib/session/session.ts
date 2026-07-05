import type { Color } from '$lib/canvas/color';
import type { TabSnapshot } from '$lib/canvas/workspace-snapshot';
import { createAutoSaveDirtyNotifier } from '$lib/canvas/editor-session/dirty-notifier';
import { createEditorSession } from '$lib/canvas/editor-session/create-editor-session';
import type { InputPipeline } from '$lib/canvas/editor-session/input-pipeline.svelte';
import type { Workspace } from '$lib/canvas/editor-session/workspace.svelte';
import { SessionStorage } from './session-storage';
import { SessionPersistence } from './session-persistence';
import { AutoSave } from './auto-save';
import type { SavedDocumentSummary } from './session-storage-types';

/** Handle for controlling session persistence (auto-save, flush, cleanup). */
export interface SessionHandle {
	/**
	 * Mark a document as needing save. Under normal use the Workspace
	 * auto-emits this on every persistable mutation; direct callers are
	 * tests and consumers that need to flush state mutated outside the
	 * workspace surface.
	 */
	markDirty(documentId: string): void;
	/**
	 * Notify that a tab was closed. Under normal use the Workspace
	 * auto-emits this from `closeTab`; direct callers are tests and
	 * orchestration code that closes tabs outside the workspace.
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
	/** Return the full saved document snapshot used when reopening a saved document. */
	getSavedDocumentSnapshot(documentId: string): Promise<TabSnapshot | null>;
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
	async getSavedDocumentSnapshot() { return null; },
	dispose() {}
};

export interface OpenSessionOptions {
	foregroundColor?: Color;
	gridColor?: string;
	debounceMs?: number;
}

/**
 * Open a session: restore prior workspace from IndexedDB, wire the dirty
 * notifier to AutoSave, and assemble the editor session. Returns a fresh
 * workspace with a no-op session handle if storage is unavailable.
 */
export async function openSession(
	options: OpenSessionOptions
): Promise<{ workspace: Workspace; input: InputPipeline; session: SessionHandle }> {
	let storage: SessionStorage | undefined;
	try {
		storage = await SessionStorage.open();
		const persistence = new SessionPersistence(storage);
		const restored = await persistence.restore();

		let workspaceRef: Workspace | null = null;
		const autoSave = new AutoSave(
			persistence,
			() => {
				if (!workspaceRef) throw new Error('openSession: workspace not yet assigned');
				return workspaceRef.toSnapshot();
			},
			options.debounceMs
		);
		const notifier = createAutoSaveDirtyNotifier(autoSave);

		const { workspace, input } = createEditorSession({
			notifier,
			gridColor: options.gridColor,
			initialForegroundColor: options.foregroundColor,
			restored: restored ?? undefined
		});
		workspaceRef = workspace;

		const session: SessionHandle = {
			markDirty: (docId) => autoSave.markDirty(docId),
			notifyTabClosed: (docId) => autoSave.notifyTabRemoved(docId),
			flush: () => autoSave.flush(),
			isDocumentSaved: (docId) => persistence.isDocumentSaved(docId),
			saveDocumentAs: (docId, name) => persistence.saveDocumentAs(docId, name),
			deleteDocument: (docId) => persistence.deleteDocument(docId),
			getAllSavedDocuments: () => persistence.getAllSavedDocuments(),
			getSavedDocumentSnapshot: (docId) => persistence.getSavedDocumentSnapshot(docId),
			dispose: () => {
				autoSave.dispose();
				storage!.close();
			}
		};

		return { workspace, input, session };
	} catch (error) {
		storage?.close();
		console.warn('Session persistence unavailable, starting with a fresh workspace:', error);
		const { workspace, input } = createEditorSession({
			notifier: { markDirty() {}, notifyTabRemoved() {} },
			gridColor: options.gridColor,
			initialForegroundColor: options.foregroundColor
		});
		return { workspace, input, session: NO_OP_SESSION };
	}
}
