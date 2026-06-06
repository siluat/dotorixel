import type { SavedDocumentSummary } from '$lib/session/session-storage-types';

/**
 * Which page-level, keyboard-blocking dialog is currently open in the editor,
 * together with its payload. At most one is open at a time: opening another
 * replaces it, which is how the "single active dialog" invariant is enforced.
 *
 * Scope is deliberately narrow — the four mutually-exclusive dialogs that
 * capture keyboard focus (the editor key handler bails while any is open):
 * the unsaved-close confirmation, the saved-work browser, the reference
 * gallery, and the reference-layer replace confirmation. The export bottom
 * sheet is per-Document and lives on the active tab (`activeTab.isExportUIOpen`);
 * reference-layer import progress and error toasts are non-blocking transient
 * overlays. None of those belong here.
 *
 * Distinct from `$lib/ui/modal` (`createModal`), which owns a single open
 * dialog's DOM behavior — focus trap, scroll lock, ESC. This owns *which*
 * dialog is open; that owns *how* an open one behaves.
 */
export type ActiveModal =
	| { kind: 'save'; tabIndex: number }
	| { kind: 'savedWork'; documents: SavedDocumentSummary[]; openingId: string | null }
	| { kind: 'references' }
	| { kind: 'refReplace' }
	| null;

export class ModalState {
	#active = $state<ActiveModal>(null);

	/** The open dialog and its payload, or `null` when none is open. */
	get active(): ActiveModal {
		return this.#active;
	}

	/** Whether any dialog is open — the editor key handler reads this to bail. */
	get isOpen(): boolean {
		return this.#active !== null;
	}

	/** Open the unsaved-close confirmation for the tab at `tabIndex`. */
	openSave(tabIndex: number): void {
		this.#active = { kind: 'save', tabIndex };
	}

	/** Open the saved-work browser over `documents`, with no document yet opening. */
	openSavedWork(documents: SavedDocumentSummary[]): void {
		this.#active = { kind: 'savedWork', documents, openingId: null };
	}

	/** Open the reference gallery browser. */
	openReferences(): void {
		this.#active = { kind: 'references' };
	}

	/** Open the reference-layer replace confirmation. */
	openRefReplace(): void {
		this.#active = { kind: 'refReplace' };
	}

	/** Close whatever dialog is open. */
	close(): void {
		this.#active = null;
	}

	/**
	 * Track which saved document is currently being opened, guarding against
	 * concurrent opens. No-op unless the saved-work browser is the active dialog.
	 */
	setSavedWorkOpeningId(id: string | null): void {
		const active = this.#active;
		if (active?.kind !== 'savedWork') return;
		this.#active = { ...active, openingId: id };
	}

	/**
	 * Drop one document from the open saved-work list, leaving the browser open.
	 * No-op unless the saved-work browser is the active dialog.
	 */
	removeSavedWorkDoc(id: string): void {
		const active = this.#active;
		if (active?.kind !== 'savedWork') return;
		this.#active = { ...active, documents: active.documents.filter((doc) => doc.id !== id) };
	}
}
