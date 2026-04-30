// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import ReferenceBrowser from './ReferenceBrowser.svelte';
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
		addedAt: new Date('2026-04-29T00:00:00Z'),
		...overrides
	};
}

function renderBrowser(
	props: Partial<{
		references: ReferenceImage[];
		errors: string[];
		onSelect: (ref: ReferenceImage) => void;
		onDelete: (id: string) => void | Promise<void>;
		onAddRequest: () => void;
		onDismissError: (index: number) => void;
		onClose: () => void;
		onFilesDropped: (files: File[]) => void;
	}> = {}
) {
	const defaults = {
		references: [],
		errors: [],
		onSelect: vi.fn(),
		onDelete: vi.fn(),
		onAddRequest: vi.fn(),
		onDismissError: vi.fn(),
		onClose: vi.fn(),
		onFilesDropped: vi.fn()
	};
	const merged = { ...defaults, ...props };
	const result = render(ReferenceBrowser, { props: merged });
	return { ...result, ...merged };
}

function fileDataTransfer(files: File[]): DataTransfer {
	const dt = new DataTransfer();
	for (const f of files) dt.items.add(f);
	return dt;
}

afterEach(() => {
	cleanup();
});

describe('ReferenceBrowser drop target', () => {
	it('calls onFilesDropped with the dropped files when files are released over the modal', async () => {
		const { container, onFilesDropped } = renderBrowser();
		const modal = container.querySelector('.browser-modal') as HTMLElement;
		const files = [
			new File([new Uint8Array([0])], 'a.png', { type: 'image/png' }),
			new File([new Uint8Array([0])], 'b.png', { type: 'image/png' })
		];

		await fireEvent.drop(modal, { dataTransfer: fileDataTransfer(files) });

		expect(onFilesDropped).toHaveBeenCalledOnce();
		const arg = (onFilesDropped as Mock).mock.calls[0][0] as File[];
		expect(arg.map((f) => f.name)).toEqual(['a.png', 'b.png']);
	});

	it('marks the modal as drag-over while files are dragged over it and clears it on drop', async () => {
		const { container } = renderBrowser();
		const modal = container.querySelector('.browser-modal') as HTMLElement;
		const dt = fileDataTransfer([new File([''], 'x.png', { type: 'image/png' })]);

		await fireEvent.dragEnter(modal, { dataTransfer: dt });
		expect(modal.getAttribute('data-drag-over')).toBe('true');

		await fireEvent.drop(modal, { dataTransfer: dt });
		expect(modal.getAttribute('data-drag-over')).toBe('false');
	});

	it('clears the drag-over highlight when the dragged files leave the modal', async () => {
		const { container } = renderBrowser();
		const modal = container.querySelector('.browser-modal') as HTMLElement;
		const dt = fileDataTransfer([new File([''], 'x.png', { type: 'image/png' })]);

		await fireEvent.dragEnter(modal, { dataTransfer: dt });
		expect(modal.getAttribute('data-drag-over')).toBe('true');

		await fireEvent.dragLeave(modal, { dataTransfer: dt });
		expect(modal.getAttribute('data-drag-over')).toBe('false');
	});

	it('ignores drag events that do not carry files (e.g. text selection)', async () => {
		const { container, onFilesDropped } = renderBrowser();
		const modal = container.querySelector('.browser-modal') as HTMLElement;
		const dt = new DataTransfer();
		dt.setData('text/plain', 'hello');

		await fireEvent.dragEnter(modal, { dataTransfer: dt });
		expect(modal.getAttribute('data-drag-over')).toBe('false');

		await fireEvent.drop(modal, { dataTransfer: dt });
		expect(onFilesDropped).not.toHaveBeenCalled();
	});
});
