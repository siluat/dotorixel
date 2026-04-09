// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import SavedWorkBrowserSheet from './SavedWorkBrowserSheet.svelte';
import type { SavedDocumentSummary } from '$lib/session/session-storage-types';

function createDoc(overrides: Partial<SavedDocumentSummary> = {}): SavedDocumentSummary {
	return {
		id: 'doc-1',
		name: 'My Pixel Art',
		width: 16,
		height: 16,
		pixels: new Uint8Array(16 * 16 * 4),
		updatedAt: new Date('2026-04-01T12:00:00Z'),
		...overrides
	};
}

afterEach(() => {
	cleanup();
});

describe('SavedWorkBrowserSheet', () => {
	it('renders card grid content when open with documents', () => {
		const docs = [
			createDoc({ id: 'a', name: 'Art A' }),
			createDoc({ id: 'b', name: 'Art B' })
		];
		render(SavedWorkBrowserSheet, {
			props: {
				open: true,
				documents: docs,
				onSelect: vi.fn(),
				onDelete: vi.fn(),
				onClose: vi.fn()
			}
		});

		const cards = document.querySelectorAll('.card');
		expect(cards).toHaveLength(2);
	});

	it('renders empty state when open with no documents', () => {
		render(SavedWorkBrowserSheet, {
			props: {
				open: true,
				documents: [],
				onSelect: vi.fn(),
				onDelete: vi.fn(),
				onClose: vi.fn()
			}
		});

		expect(document.querySelector('.empty-state')).not.toBeNull();
	});
});
