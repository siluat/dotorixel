import type { AutoSave } from '$lib/session/auto-save';

/**
 * Port that editor-session layers (TabState, Workspace) use to signal that
 * persistable state has changed. Implementations decide how to react — e.g.
 * the production adapter debounces through `AutoSave`, while tests use a
 * recording fake.
 *
 * Production adapter: `createAutoSaveDirtyNotifier(autoSave)`.
 * Test adapter: `createFakeDirtyNotifier()` from `./fake-dirty-notifier.ts`.
 */
export interface DirtyNotifier {
	/** A document's persistable state changed. */
	markDirty(documentId: string): void;
	/** A document was removed; flush any pending state for it. */
	notifyTabRemoved(documentId: string): void;
}

/**
 * Wraps an `AutoSave` instance as a `DirtyNotifier`. The notifier owns no
 * state of its own — every call delegates to the enclosed `AutoSave`.
 */
export function createAutoSaveDirtyNotifier(autoSave: AutoSave): DirtyNotifier {
	return {
		markDirty: (documentId) => autoSave.markDirty(documentId),
		notifyTabRemoved: (documentId) => autoSave.notifyTabRemoved(documentId)
	};
}
