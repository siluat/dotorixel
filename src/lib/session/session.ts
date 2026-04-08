import type { Color } from '$lib/canvas/color';
import { Workspace } from '$lib/canvas/workspace.svelte';
import { SessionStorage } from './session-storage';
import { SessionPersistence } from './session-persistence';
import { AutoSave } from './auto-save';

/** Handle for controlling session persistence (auto-save, flush, cleanup). */
export interface SessionHandle {
	/** Mark a document as needing save. Resets the debounce timer. */
	markDirty(documentId: string): void;
	/** Notify that a tab was closed. Schedules removal of its stored record. */
	notifyTabClosed(documentId: string): void;
	/** Immediately persist all pending changes. No-ops when nothing is dirty. */
	flush(): Promise<void>;
	/** Tear down timers and close the storage connection. */
	dispose(): void;
}

const NO_OP_SESSION: SessionHandle = {
	markDirty() {},
	notifyTabClosed() {},
	async flush() {},
	dispose() {}
};

/**
 * Open a session: restore prior workspace from IndexedDB and set up auto-save.
 * Returns a fresh workspace with a no-op session handle if storage is unavailable.
 */
export async function openSession(defaults: {
	foregroundColor?: Color;
	gridColor?: string;
	debounceMs?: number;
}): Promise<{ workspace: Workspace; session: SessionHandle }> {
	let storage: SessionStorage | undefined;
	try {
		storage = await SessionStorage.open();
		const persistence = new SessionPersistence(storage);
		const restored = await persistence.restore();

		const workspace = new Workspace({
			foregroundColor: defaults.foregroundColor,
			gridColor: defaults.gridColor ?? '#cccccc',
			restored: restored ?? undefined
		});

		const autoSave = new AutoSave(persistence, () => workspace.toSnapshot(), defaults.debounceMs);

		const session: SessionHandle = {
			markDirty: (docId) => autoSave.markDirty(docId),
			notifyTabClosed: (docId) => autoSave.notifyTabRemoved(docId),
			flush: () => autoSave.flush(),
			dispose: () => {
				autoSave.dispose();
				storage!.close();
			}
		};

		return { workspace, session };
	} catch (error) {
		storage?.close();
		console.warn('Session persistence unavailable, starting with a fresh workspace:', error);
		const workspace = new Workspace({
			foregroundColor: defaults.foregroundColor,
			gridColor: defaults.gridColor ?? '#cccccc'
		});
		return { workspace, session: NO_OP_SESSION };
	}
}
