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

	it('title-bar drag emits onMove with the new absolute position based on pointer delta', async () => {
		const ref = makeRef('ref-1');
		const onMove = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 100,
			y: 100,
			width: 200,
			height: 200,
			isActive: true,
			onClose: vi.fn(),
			onMove
		});

		const titleBar = screen.getByText(ref.filename).parentElement!;
		await fireEvent.pointerDown(titleBar, { pointerId: 1, clientX: 50, clientY: 60 });
		await fireEvent.pointerMove(titleBar, { pointerId: 1, clientX: 80, clientY: 110 });

		expect(onMove).toHaveBeenCalledWith(130, 150);
	});

	it('bottom-right handle drag emits onResize with the aspect ratio preserved', async () => {
		const ref = makeRef('ref-1');
		const onResize = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			isActive: true,
			onClose: vi.fn(),
			onResize
		});

		const handle = screen.getByRole('button', { name: /resize/i });
		await fireEvent.pointerDown(handle, { pointerId: 1, clientX: 200, clientY: 100 });
		await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 250, clientY: 150 });

		expect(onResize).toHaveBeenCalledWith(300, 150);
	});

	it('does not start a drag when pointerdown originates from a button inside the title bar', async () => {
		const ref = makeRef('ref-1');
		const onMove = vi.fn();
		const onMoveCommit = vi.fn();

		render(ReferenceWindow, {
			reference: ref,
			x: 100,
			y: 100,
			width: 200,
			height: 200,
			isActive: true,
			onClose: vi.fn(),
			onMove,
			onMoveCommit
		});

		const closeButton = screen.getByRole('button', { name: /close/i });
		await fireEvent.pointerDown(closeButton, { pointerId: 1, clientX: 0, clientY: 0 });
		await fireEvent.pointerMove(closeButton, { pointerId: 1, clientX: 50, clientY: 50 });
		await fireEvent.pointerUp(closeButton, { pointerId: 1, clientX: 50, clientY: 50 });

		expect(onMove).not.toHaveBeenCalled();
		expect(onMoveCommit).not.toHaveBeenCalled();
	});

	it('absorbs pointer events so a hit-test inside the window does not pass through to siblings', () => {
		const ref = makeRef('ref-1');

		render(ReferenceWindow, {
			reference: ref,
			x: 0,
			y: 0,
			width: 200,
			height: 200,
			isActive: true,
			onClose: vi.fn()
		});

		const win = screen.getByRole('dialog');
		expect(win.style.pointerEvents).toBe('auto');
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
