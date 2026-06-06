// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { ModalState } from './modal-state.svelte';
import type { SavedDocumentSummary } from '$lib/session/session-storage-types';

function summary(id: string): SavedDocumentSummary {
	return { id, name: id, width: 1, height: 1, pixels: new Uint8Array(4), updatedAt: new Date(0) };
}

describe('ModalState', () => {
	it('opens with no dialog', () => {
		expect(new ModalState().active).toBeNull();
	});

	it('opens the save dialog carrying the target tab index', () => {
		const modal = new ModalState();
		modal.openSave(3);
		expect(modal.active).toEqual({ kind: 'save', tabIndex: 3 });
	});

	it('opens the saved-work browser carrying its documents, with no document opening yet', () => {
		const modal = new ModalState();
		const docs = [summary('a'), summary('b')];
		modal.openSavedWork(docs);
		expect(modal.active).toEqual({ kind: 'savedWork', documents: docs, openingId: null });
	});

	it('opens the references and reference-replace dialogs', () => {
		const modal = new ModalState();
		modal.openReferences();
		expect(modal.active).toEqual({ kind: 'references' });
		modal.openRefReplace();
		expect(modal.active).toEqual({ kind: 'refReplace' });
	});

	it('closes whatever dialog is open', () => {
		const modal = new ModalState();
		modal.openReferences();
		modal.close();
		expect(modal.active).toBeNull();
	});

	it('reports whether any dialog is open', () => {
		const modal = new ModalState();
		expect(modal.isOpen).toBe(false);
		modal.openReferences();
		expect(modal.isOpen).toBe(true);
		modal.close();
		expect(modal.isOpen).toBe(false);
	});

	it('keeps at most one dialog open — opening another replaces the first', () => {
		const modal = new ModalState();
		modal.openSave(1);
		modal.openReferences();
		expect(modal.active).toEqual({ kind: 'references' });
	});

	describe('saved-work opening guard', () => {
		it('records which document is being opened', () => {
			const modal = new ModalState();
			modal.openSavedWork([summary('a')]);
			modal.setSavedWorkOpeningId('a');
			expect(modal.active).toMatchObject({ kind: 'savedWork', openingId: 'a' });
		});

		it('ignores an opening id when the saved-work browser is not the active dialog', () => {
			const modal = new ModalState();
			modal.openReferences();
			modal.setSavedWorkOpeningId('a');
			expect(modal.active).toEqual({ kind: 'references' });
		});

		it('drops the opening id on a fresh saved-work open', () => {
			const modal = new ModalState();
			modal.openSavedWork([summary('a')]);
			modal.setSavedWorkOpeningId('a');
			modal.openSavedWork([summary('a'), summary('b')]);
			expect(modal.active).toMatchObject({ openingId: null });
		});
	});

	describe('removeSavedWorkDoc', () => {
		it('drops one document and leaves the browser open', () => {
			const modal = new ModalState();
			modal.openSavedWork([summary('a'), summary('b')]);
			modal.removeSavedWorkDoc('a');
			expect(modal.active).toEqual({
				kind: 'savedWork',
				documents: [summary('b')],
				openingId: null
			});
		});

		it('leaves the browser open even when the last document is removed', () => {
			const modal = new ModalState();
			modal.openSavedWork([summary('a')]);
			modal.removeSavedWorkDoc('a');
			expect(modal.active).toEqual({ kind: 'savedWork', documents: [], openingId: null });
		});

		it('is a no-op when the saved-work browser is not the active dialog', () => {
			const modal = new ModalState();
			modal.openSave(0);
			modal.removeSavedWorkDoc('a');
			expect(modal.active).toEqual({ kind: 'save', tabIndex: 0 });
		});
	});
});
