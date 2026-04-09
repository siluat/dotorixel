// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import SavedWorkCardGrid from './SavedWorkCardGrid.svelte';
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

function renderGrid(props: Partial<{
	documents: SavedDocumentSummary[];
	onSelect: (doc: SavedDocumentSummary) => void;
	onDelete: (id: string) => void;
}> = {}) {
	const defaults = {
		documents: [createDoc()],
		onSelect: vi.fn(),
		onDelete: vi.fn()
	};
	const merged = { ...defaults, ...props };
	const result = render(SavedWorkCardGrid, { props: merged });
	return { ...result, ...merged };
}

afterEach(() => {
	cleanup();
});

describe('SavedWorkCardGrid', () => {
	it('renders a card for each document', () => {
		const docs = [
			createDoc({ id: 'a', name: 'Art A' }),
			createDoc({ id: 'b', name: 'Art B' }),
			createDoc({ id: 'c', name: 'Art C' })
		];
		const { container } = renderGrid({ documents: docs });

		const cards = container.querySelectorAll('.card');
		expect(cards).toHaveLength(3);

		const names = [...container.querySelectorAll('.card-name')].map((el) => el.textContent);
		expect(names).toEqual(['Art A', 'Art B', 'Art C']);
	});

	it('calls onSelect when a card is clicked', async () => {
		const doc = createDoc({ id: 'x', name: 'Selected' });
		const { container, onSelect } = renderGrid({ documents: [doc] });

		const openBtn = container.querySelector('.card-open')!;
		await fireEvent.click(openBtn);

		expect(onSelect).toHaveBeenCalledOnce();
		expect(onSelect).toHaveBeenCalledWith(doc);
	});

	it('calls onDelete after delete confirmation', async () => {
		const doc = createDoc({ id: 'del-1', name: 'To Delete' });
		const { container, onDelete } = renderGrid({ documents: [doc] });

		const deleteBtn = container.querySelector('.card-delete')!;
		await fireEvent.click(deleteBtn);

		const confirmBtn = document.querySelector('.btn-delete')!;
		await fireEvent.click(confirmBtn);

		expect(onDelete).toHaveBeenCalledOnce();
		expect(onDelete).toHaveBeenCalledWith('del-1');
	});

	it('shows empty state when documents list is empty', () => {
		const { container } = renderGrid({ documents: [] });

		expect(container.querySelector('.empty-state')).not.toBeNull();
		expect(container.querySelector('.card-grid')).toBeNull();
	});
});
