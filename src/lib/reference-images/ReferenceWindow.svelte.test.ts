// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import ReferenceWindow from './ReferenceWindow.svelte';
import type { ReferenceImage } from './reference-image-types';

afterEach(() => cleanup());

function makeRef(id: string, filename = `${id}.png`): ReferenceImage {
	return {
		id,
		filename,
		blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
		thumbnail: new Blob([new Uint8Array([4, 5, 6])], { type: 'image/png' }),
		mimeType: 'image/png',
		naturalWidth: 100,
		naturalHeight: 200,
		byteSize: 3,
		addedAt: new Date('2026-04-26T00:00:00Z')
	};
}

describe('ReferenceWindow', () => {
	it('positions the window using the provided x/y/width/height', () => {
		const ref = makeRef('ref-1');

		render(ReferenceWindow, {
			reference: ref,
			x: 40,
			y: 60,
			width: 200,
			height: 300,
			isActive: true,
			onClose: vi.fn()
		});

		const win = screen.getByRole('dialog');
		expect(win.style.left).toBe('40px');
		expect(win.style.top).toBe('60px');
		expect(win.style.width).toBe('200px');
		expect(win.style.height).toBe('300px');
	});

	it('renders the reference image in the body', () => {
		const ref = makeRef('ref-1');

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			onClose: vi.fn()
		});

		const img = screen.getByRole('img');
		expect(img.getAttribute('src')).toMatch(/^blob:/);
	});

	it('calls onClose when the close button is clicked', async () => {
		const ref = makeRef('ref-1');
		const onClose = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			onClose
		});

		const closeButton = screen.getByRole('button', { name: /close/i });
		await fireEvent.click(closeButton);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('marks itself active or inactive via data attribute for styling', () => {
		const ref = makeRef('ref-1');

		const { rerender } = render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: true,
			onClose: vi.fn()
		});

		const win = screen.getByRole('dialog');
		expect(win.getAttribute('data-active')).toBe('true');

		rerender({
			reference: ref,
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			isActive: false,
			onClose: vi.fn()
		});

		expect(win.getAttribute('data-active')).toBe('false');
	});
});
