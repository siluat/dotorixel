// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import ReferenceGalleryGrid from './ReferenceGalleryGrid.svelte';
import type { ReferenceImage } from './reference-image-types';

function makeRef(overrides: Partial<ReferenceImage> = {}): ReferenceImage {
	return {
		id: 'ref-1',
		filename: 'sketch.png',
		blob: new Blob([new Uint8Array([0])], { type: 'image/png' }),
		thumbnail: new Blob([new Uint8Array([0])], { type: 'image/png' }),
		mimeType: 'image/png',
		naturalWidth: 1024,
		naturalHeight: 768,
		byteSize: 1,
		addedAt: new Date('2026-04-26T00:00:00Z'),
		...overrides
	};
}

function renderGrid(
	props: Partial<{
		references: ReferenceImage[];
		displayedRefIds: ReadonlySet<string>;
		onSelect: (ref: ReferenceImage) => void;
		onDelete: (id: string) => void | Promise<void>;
		onToggleDisplay: (ref: ReferenceImage) => void;
	}> = {}
) {
	const defaults = {
		references: [makeRef()],
		displayedRefIds: new Set<string>(),
		onSelect: vi.fn(),
		onDelete: vi.fn(),
		onToggleDisplay: vi.fn()
	};
	const merged = { ...defaults, ...props };
	const result = render(ReferenceGalleryGrid, { props: merged });
	return { ...result, ...merged };
}

afterEach(() => {
	cleanup();
});

describe('ReferenceGalleryGrid', () => {
	it('shows empty state when references list is empty', () => {
		const { container } = renderGrid({ references: [] });

		expect(container.querySelector('.empty-state')).not.toBeNull();
		expect(container.querySelector('.card-grid')).toBeNull();
	});

	it('renders a card for each reference with filename and dimensions', () => {
		const refs = [
			makeRef({ id: 'a', filename: 'one.png', naturalWidth: 100, naturalHeight: 100 }),
			makeRef({ id: 'b', filename: 'two.jpg', naturalWidth: 200, naturalHeight: 150 })
		];
		const { container } = renderGrid({ references: refs });

		const cards = container.querySelectorAll('.card');
		expect(cards).toHaveLength(2);

		const names = [...container.querySelectorAll('.card-name')].map((el) => el.textContent);
		expect(names).toEqual(['one.png', 'two.jpg']);

		const metas = [...container.querySelectorAll('.card-meta')].map((el) => el.textContent);
		expect(metas[0]).toContain('100');
		expect(metas[1]).toContain('200');
		expect(metas[1]).toContain('150');
	});

	it('calls onSelect when a card body is clicked', async () => {
		const ref = makeRef({ id: 'sel', filename: 'pick.png' });
		const { container, onSelect } = renderGrid({ references: [ref] });

		const openBtn = container.querySelector('.card-open')!;
		await fireEvent.click(openBtn);

		expect(onSelect).toHaveBeenCalledOnce();
		expect(onSelect).toHaveBeenCalledWith(ref);
	});

	it('calls onDelete after delete confirmation', async () => {
		const ref = makeRef({ id: 'del-1', filename: 'remove.png' });
		const { container, onDelete } = renderGrid({ references: [ref] });

		const deleteBtn = container.querySelector('.card-delete')!;
		await fireEvent.click(deleteBtn);

		const confirmBtn = document.querySelector('.btn-delete')!;
		await fireEvent.click(confirmBtn);

		expect(onDelete).toHaveBeenCalledOnce();
		expect(onDelete).toHaveBeenCalledWith('del-1');
	});

	it('renders an Eye toggle button on each card', () => {
		const refs = [
			makeRef({ id: 'a', filename: 'one.png' }),
			makeRef({ id: 'b', filename: 'two.png' })
		];
		const { container } = renderGrid({ references: refs });

		expect(container.querySelectorAll('.card-display-toggle')).toHaveLength(2);
	});

	it('calls onToggleDisplay when the Eye button is clicked, not onSelect', async () => {
		const ref = makeRef({ id: 'eye-1', filename: 'visible.png' });
		const { container, onToggleDisplay, onSelect } = renderGrid({ references: [ref] });

		const toggleBtn = container.querySelector('.card-display-toggle')!;
		await fireEvent.click(toggleBtn);

		expect(onToggleDisplay).toHaveBeenCalledOnce();
		expect(onToggleDisplay).toHaveBeenCalledWith(ref);
		expect(onSelect).not.toHaveBeenCalled();
	});

	it('marks cards in displayedRefIds via data-displayed', () => {
		const refs = [
			makeRef({ id: 'a', filename: 'one.png' }),
			makeRef({ id: 'b', filename: 'two.png' })
		];
		const { container } = renderGrid({
			references: refs,
			displayedRefIds: new Set(['a'])
		});

		const cards = container.querySelectorAll('.card');
		expect(cards[0].getAttribute('data-displayed')).toBe('true');
		expect(cards[1].getAttribute('data-displayed')).toBe('false');
	});
});
