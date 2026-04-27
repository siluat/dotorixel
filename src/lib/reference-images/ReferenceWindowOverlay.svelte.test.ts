// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import ReferenceWindowOverlay from './ReferenceWindowOverlay.svelte';
import { ReferenceImagesStore } from './reference-images-store.svelte';
import { createFakeDirtyNotifier } from '$lib/canvas/editor-session/fake-dirty-notifier';
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
		naturalHeight: 100,
		byteSize: 3,
		addedAt: new Date('2026-04-26T00:00:00Z')
	};
}

describe('ReferenceWindowOverlay', () => {
	let store: ReferenceImagesStore;

	beforeEach(() => {
		store = new ReferenceImagesStore({ notifier: createFakeDirtyNotifier() });
	});

	it('renders nothing when no display states are visible', () => {
		render(ReferenceWindowOverlay, { store, docId: 'doc-1' });
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('renders one window per visible display state for the active doc', () => {
		store.add(makeRef('ref-1'), 'doc-1');
		store.add(makeRef('ref-2'), 'doc-1');
		store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 100 });
		store.display('ref-2', 'doc-1', { x: 50, y: 60, width: 80, height: 80 });

		render(ReferenceWindowOverlay, { store, docId: 'doc-1' });

		const windows = screen.getAllByRole('dialog');
		expect(windows).toHaveLength(2);
	});

	it('does not render windows from other docs', () => {
		store.add(makeRef('ref-1'), 'doc-1');
		store.add(makeRef('ref-2'), 'doc-2');
		store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 100 });
		store.display('ref-2', 'doc-2', { x: 30, y: 40, width: 80, height: 80 });

		render(ReferenceWindowOverlay, { store, docId: 'doc-1' });

		const windows = screen.getAllByRole('dialog');
		expect(windows).toHaveLength(1);
		expect(windows[0].getAttribute('aria-label')).toBe('ref-1.png');
	});

	it('hides closed windows but keeps visible ones', () => {
		store.add(makeRef('ref-1'), 'doc-1');
		store.add(makeRef('ref-2'), 'doc-1');
		store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 100 });
		store.display('ref-2', 'doc-1', { x: 50, y: 60, width: 80, height: 80 });
		store.close('ref-1', 'doc-1');

		render(ReferenceWindowOverlay, { store, docId: 'doc-1' });

		const windows = screen.getAllByRole('dialog');
		expect(windows).toHaveLength(1);
		expect(windows[0].getAttribute('aria-label')).toBe('ref-2.png');
	});

	it('marks the highest-zOrder visible window as active', () => {
		store.add(makeRef('ref-1'), 'doc-1');
		store.add(makeRef('ref-2'), 'doc-1');
		store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 100 }); // z=1
		store.display('ref-2', 'doc-1', { x: 50, y: 60, width: 80, height: 80 }); // z=2

		render(ReferenceWindowOverlay, { store, docId: 'doc-1' });

		const win1 = screen.getByRole('dialog', { name: 'ref-1.png' });
		const win2 = screen.getByRole('dialog', { name: 'ref-2.png' });
		expect(win1.getAttribute('data-active')).toBe('false');
		expect(win2.getAttribute('data-active')).toBe('true');
	});

	it('clicking close on a window calls store.close for that ref', async () => {
		store.add(makeRef('ref-1'), 'doc-1');
		store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 100 });
		const spy = vi.spyOn(store, 'close');

		render(ReferenceWindowOverlay, { store, docId: 'doc-1' });

		const closeButton = screen.getByRole('button', { name: /close/i });
		await fireEvent.click(closeButton);

		expect(spy).toHaveBeenCalledWith('ref-1', 'doc-1');
	});

	it('fits a window larger than the viewport into the viewport for rendering', () => {
		store.add(makeRef('ref-1'), 'doc-1');
		store.display('ref-1', 'doc-1', { x: 0, y: 0, width: 800, height: 600 });

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 360,
			viewportHeight: 500
		});

		const win = screen.getByRole('dialog');
		expect(win.style.left).toBe('0px');
		expect(win.style.top).toBe('0px');
		expect(win.style.width).toBe('360px');
		expect(win.style.height).toBe('500px');
	});

	it('clamps render position so a window placed off-screen returns into the viewport', () => {
		store.add(makeRef('ref-1'), 'doc-1');
		store.display('ref-1', 'doc-1', { x: 550, y: 350, width: 100, height: 100 });

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 360,
			viewportHeight: 500
		});

		const win = screen.getByRole('dialog');
		expect(win.style.left).toBe('260px');
		expect(win.style.top).toBe('350px');
		expect(win.style.width).toBe('100px');
		expect(win.style.height).toBe('100px');
	});

	it('writes the new position to the store when a window is dragged by the title bar', async () => {
		store.add(makeRef('ref-1'), 'doc-1');
		store.display('ref-1', 'doc-1', { x: 100, y: 100, width: 200, height: 200 });
		const spy = vi.spyOn(store, 'setDisplayPosition');

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 1000,
			viewportHeight: 800
		});

		const titleBar = screen.getByText('ref-1.png').parentElement!;
		await fireEvent.pointerDown(titleBar, { pointerId: 1, clientX: 0, clientY: 0 });
		await fireEvent.pointerMove(titleBar, { pointerId: 1, clientX: 50, clientY: 30 });

		expect(spy).toHaveBeenLastCalledWith('ref-1', 'doc-1', 150, 130);
	});

	it('clamps the stored position back into the viewport when the drag is released', async () => {
		store.add(makeRef('ref-1'), 'doc-1');
		store.display('ref-1', 'doc-1', { x: 100, y: 100, width: 200, height: 200 });

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 1000,
			viewportHeight: 800
		});

		const titleBar = screen.getByText('ref-1.png').parentElement!;
		await fireEvent.pointerDown(titleBar, { pointerId: 1, clientX: 0, clientY: 0 });
		await fireEvent.pointerMove(titleBar, { pointerId: 1, clientX: 2000, clientY: 2000 });
		await fireEvent.pointerUp(titleBar, { pointerId: 1, clientX: 2000, clientY: 2000 });

		const state = store.displayStateFor('ref-1', 'doc-1');
		expect(state).toMatchObject({ x: 800, y: 600 });
	});

	it('writes the new size to the store when a window is resized by the corner handle', async () => {
		store.add(makeRef('ref-1'), 'doc-1');
		store.display('ref-1', 'doc-1', { x: 100, y: 100, width: 200, height: 100 });
		const spy = vi.spyOn(store, 'setDisplaySize');

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 1000,
			viewportHeight: 800
		});

		const handle = screen.getByRole('button', { name: /resize/i });
		await fireEvent.pointerDown(handle, { pointerId: 1, clientX: 300, clientY: 200 });
		await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 350, clientY: 250 });

		expect(spy).toHaveBeenLastCalledWith('ref-1', 'doc-1', 300, 150);
	});

	it('preserves the stored placement and uses it when the viewport is large again', () => {
		store.add(makeRef('ref-1'), 'doc-1');
		store.display('ref-1', 'doc-1', { x: 550, y: 350, width: 400, height: 300 });

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 1200,
			viewportHeight: 800
		});

		const win = screen.getByRole('dialog');
		expect(win.style.left).toBe('550px');
		expect(win.style.top).toBe('350px');
		expect(win.style.width).toBe('400px');
		expect(win.style.height).toBe('300px');

		// Underlying store record stays unchanged
		const state = store.displayStateFor('ref-1', 'doc-1');
		expect(state).toMatchObject({ x: 550, y: 350, width: 400, height: 300 });
	});
});
