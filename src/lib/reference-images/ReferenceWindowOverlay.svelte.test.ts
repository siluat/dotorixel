// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import ReferenceWindowOverlay from './ReferenceWindowOverlay.svelte';
import { References } from './references.svelte';
import { createFakeDirtyNotifier } from '$lib/canvas/editor-session/fake-dirty-notifier';
import type { ReferenceImage } from './reference-image-types';
import type { ReferenceWindowState } from './reference-window-state-types';

afterEach(() => cleanup());

type OverlayProps = ComponentProps<typeof ReferenceWindowOverlay>;

function renderOverlay(overrides: Partial<OverlayProps> & Pick<OverlayProps, 'store' | 'docId'>) {
	return render(ReferenceWindowOverlay, {
		viewportWidth: 1000,
		viewportHeight: 1000,
		...overrides
	} as OverlayProps);
}

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

type WindowSpec = {
	ref: ReferenceImage;
	geom: { x: number; y: number; width: number; height: number };
	docId?: string;
	visible?: boolean;
	minimized?: boolean;
};

/**
 * Build a References store seeded with reference images and their window
 * states via the public restore path. Window creation is internal to the
 * lifecycle verbs, so tests seed already-placed windows rather than calling a
 * creation method. zOrder follows input order per doc.
 */
function seedStore(specs: WindowSpec[]): References {
	const refsByDoc: Record<string, ReferenceImage[]> = {};
	const windowsByDoc: Record<string, ReferenceWindowState[]> = {};
	for (const spec of specs) {
		const docId = spec.docId ?? 'doc-1';
		(refsByDoc[docId] ??= []).push(spec.ref);
		const states = (windowsByDoc[docId] ??= []);
		states.push({
			refId: spec.ref.id,
			visible: spec.visible ?? true,
			x: spec.geom.x,
			y: spec.geom.y,
			width: spec.geom.width,
			height: spec.geom.height,
			minimized: spec.minimized ?? false,
			zOrder: states.length + 1
		});
	}
	return new References({
		notifier: createFakeDirtyNotifier(),
		restored: refsByDoc,
		restoredWindowStates: windowsByDoc
	});
}

describe('ReferenceWindowOverlay', () => {
	let store: References;

	beforeEach(() => {
		store = new References({ notifier: createFakeDirtyNotifier() });
	});

	it('renders nothing when no window states are visible', () => {
		renderOverlay({ store, docId: 'doc-1' });
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('renders one window per visible window state for the active doc', () => {
		store = seedStore([
			{ ref: makeRef('ref-1'), geom: { x: 10, y: 20, width: 100, height: 100 } },
			{ ref: makeRef('ref-2'), geom: { x: 50, y: 60, width: 80, height: 80 } }
		]);

		renderOverlay({ store, docId: 'doc-1' });

		const windows = screen.getAllByRole('dialog');
		expect(windows).toHaveLength(2);
	});

	it('does not render windows from other docs', () => {
		store = seedStore([
			{ ref: makeRef('ref-1'), geom: { x: 10, y: 20, width: 100, height: 100 }, docId: 'doc-1' },
			{ ref: makeRef('ref-2'), geom: { x: 30, y: 40, width: 80, height: 80 }, docId: 'doc-2' }
		]);

		renderOverlay({ store, docId: 'doc-1' });

		const windows = screen.getAllByRole('dialog');
		expect(windows).toHaveLength(1);
		expect(windows[0].getAttribute('aria-label')).toBe('ref-1.png');
	});

	it('hides closed windows but keeps visible ones', () => {
		store = seedStore([
			{ ref: makeRef('ref-1'), geom: { x: 10, y: 20, width: 100, height: 100 }, visible: false },
			{ ref: makeRef('ref-2'), geom: { x: 50, y: 60, width: 80, height: 80 } }
		]);

		renderOverlay({ store, docId: 'doc-1' });

		const windows = screen.getAllByRole('dialog');
		expect(windows).toHaveLength(1);
		expect(windows[0].getAttribute('aria-label')).toBe('ref-2.png');
	});

	it('marks the highest-zOrder visible window as active', () => {
		store = seedStore([
			{ ref: makeRef('ref-1'), geom: { x: 10, y: 20, width: 100, height: 100 } }, // z=1
			{ ref: makeRef('ref-2'), geom: { x: 50, y: 60, width: 80, height: 80 } } // z=2
		]);

		renderOverlay({ store, docId: 'doc-1' });

		const win1 = screen.getByRole('dialog', { name: 'ref-1.png' });
		const win2 = screen.getByRole('dialog', { name: 'ref-2.png' });
		expect(win1.getAttribute('data-active')).toBe('false');
		expect(win2.getAttribute('data-active')).toBe('true');
	});

	it('clicking close on a window calls store.close for that ref', async () => {
		store = seedStore([{ ref: makeRef('ref-1'), geom: { x: 10, y: 20, width: 100, height: 100 } }]);
		const spy = vi.spyOn(store, 'close');

		renderOverlay({ store, docId: 'doc-1' });

		const closeButton = screen.getByRole('button', { name: /close/i });
		await fireEvent.click(closeButton);

		expect(spy).toHaveBeenCalledWith('ref-1', 'doc-1');
	});

	it('renders the stored placement geometry verbatim (refit/clamp is a store-side responsibility, not render-time)', () => {
		store = seedStore([
			{ ref: makeRef('ref-1'), geom: { x: 550, y: 350, width: 800, height: 600 } }
		]);

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 360,
			viewportHeight: 500
		});

		const win = screen.getByRole('dialog');
		expect(win.style.left).toBe('550px');
		expect(win.style.top).toBe('350px');
		expect(win.style.width).toBe('800px');
		expect(win.style.height).toBe('600px');
	});

	it('a title-bar drag moves the stored window by the pointer delta through the move gesture', async () => {
		store = seedStore([
			{ ref: makeRef('ref-1'), geom: { x: 100, y: 100, width: 200, height: 200 } }
		]);

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 1000,
			viewportHeight: 800
		});

		const titleBar = screen.getByText('ref-1.png').parentElement!;
		await fireEvent.pointerDown(titleBar, { pointerId: 1, clientX: 0, clientY: 0 });
		await fireEvent.pointerMove(titleBar, { pointerId: 1, clientX: 50, clientY: 30 });
		await fireEvent.pointerUp(titleBar, { pointerId: 1, clientX: 50, clientY: 30 });

		// Released inside the viewport → final position is the unclamped delta.
		expect(store.windowStateFor('ref-1', 'doc-1')).toMatchObject({ x: 150, y: 130 });
	});

	it('clamps the stored position back into the viewport when the drag is released', async () => {
		store = seedStore([
			{ ref: makeRef('ref-1'), geom: { x: 100, y: 100, width: 200, height: 200 } }
		]);

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

		const state = store.windowStateFor('ref-1', 'doc-1');
		expect(state).toMatchObject({ x: 800, y: 600 });
	});

	it('writes the minimized flag to the store when the minimize button is clicked', async () => {
		store = seedStore([
			{ ref: makeRef('ref-1'), geom: { x: 100, y: 100, width: 200, height: 200 } }
		]);
		const spy = vi.spyOn(store, 'setMinimized');

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 1000,
			viewportHeight: 800
		});

		const minimizeButton = screen.getByRole('button', { name: /minimize/i });
		await fireEvent.click(minimizeButton);

		expect(spy).toHaveBeenLastCalledWith('ref-1', 'doc-1', true);
	});

	it('a corner-handle drag resizes the stored window with aspect preserved through the resize gesture', async () => {
		store = seedStore([
			{ ref: makeRef('ref-1'), geom: { x: 100, y: 100, width: 200, height: 100 } }
		]);

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 1000,
			viewportHeight: 800
		});

		const handle = screen.getByRole('button', { name: /resize/i });
		await fireEvent.pointerDown(handle, { pointerId: 1, clientX: 300, clientY: 200 });
		await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 350, clientY: 250 });

		expect(store.windowStateFor('ref-1', 'doc-1')).toMatchObject({ width: 300, height: 150 });
	});

	it('a corner-handle drag past the viewport edge clamps the stored size live (aspect preserved)', async () => {
		store = seedStore([
			{ ref: makeRef('ref-1'), geom: { x: 100, y: 100, width: 200, height: 100 } }
		]);

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 1000,
			viewportHeight: 800
		});

		const handle = screen.getByRole('button', { name: /resize/i });
		await fireEvent.pointerDown(handle, { pointerId: 1, clientX: 300, clientY: 200 });
		await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 5000, clientY: 5000 });

		// Anchored top-left at (100, 100); viewport 1000x800 leaves 900x700 of room.
		// Aspect 2:1 → width capped at 900 (900/2 = 450 ≤ 700 vertically).
		const state = store.windowStateFor('ref-1', 'doc-1')!;
		expect(state.width).toBeCloseTo(900, 5);
		expect(state.height).toBeCloseTo(450, 5);
		expect(state.width / state.height).toBeCloseTo(2, 5);
	});

	it('pointerdown on a non-active window raises it to the top of the z-order', async () => {
		store = seedStore([
			{ ref: makeRef('ref-1'), geom: { x: 10, y: 20, width: 100, height: 100 } },
			{ ref: makeRef('ref-2'), geom: { x: 200, y: 220, width: 100, height: 100 } }
		]);

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 1000,
			viewportHeight: 800
		});

		const win1 = screen.getByRole('dialog', { name: 'ref-1.png' });
		const win2 = screen.getByRole('dialog', { name: 'ref-2.png' });
		expect(win1.getAttribute('data-active')).toBe('false');
		expect(win2.getAttribute('data-active')).toBe('true');

		await fireEvent.pointerDown(win1, { pointerId: 7, clientX: 50, clientY: 50 });

		expect(screen.getByRole('dialog', { name: 'ref-1.png' }).getAttribute('data-active')).toBe(
			'true'
		);
		expect(screen.getByRole('dialog', { name: 'ref-2.png' }).getAttribute('data-active')).toBe(
			'false'
		);
	});

	it('does not raise a non-active window when its title-bar button is pressed', async () => {
		store = seedStore([
			{ ref: makeRef('ref-1'), geom: { x: 10, y: 20, width: 100, height: 100 } },
			{ ref: makeRef('ref-2'), geom: { x: 200, y: 220, width: 100, height: 100 } }
		]);

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 1000,
			viewportHeight: 800
		});

		const win1 = screen.getByRole('dialog', { name: 'ref-1.png' });
		const closeButton = within(win1).getByRole('button', { name: /close/i });
		await fireEvent.pointerDown(closeButton, { pointerId: 8, clientX: 50, clientY: 25 });

		expect(screen.getByRole('dialog', { name: 'ref-1.png' }).getAttribute('data-active')).toBe(
			'false'
		);
		expect(screen.getByRole('dialog', { name: 'ref-2.png' }).getAttribute('data-active')).toBe(
			'true'
		);
	});

	it('raises a non-active window when its resize handle is pressed', async () => {
		store = seedStore([
			{ ref: makeRef('ref-1'), geom: { x: 10, y: 20, width: 100, height: 100 } },
			{ ref: makeRef('ref-2'), geom: { x: 200, y: 220, width: 100, height: 100 } }
		]);

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 1000,
			viewportHeight: 800
		});

		const win1 = screen.getByRole('dialog', { name: 'ref-1.png' });
		const handle = within(win1).getByRole('button', { name: /resize/i });
		await fireEvent.pointerDown(handle, { pointerId: 9, clientX: 100, clientY: 100 });

		expect(screen.getByRole('dialog', { name: 'ref-1.png' }).getAttribute('data-active')).toBe(
			'true'
		);
		expect(screen.getByRole('dialog', { name: 'ref-2.png' }).getAttribute('data-active')).toBe(
			'false'
		);
	});

	it('forwards mouse pointerdown on the image to onSampleStart with (blob, x, y, "mouse") when quickSamplingEnabled', async () => {
		const ref = makeRef('ref-1');
		store = seedStore([{ ref, geom: { x: 0, y: 0, width: 200, height: 200 } }]);
		const onSampleStart = vi.fn();

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 1000,
			viewportHeight: 800,
			quickSamplingEnabled: true,
			onSampleStart
		});

		const win = screen.getByRole('dialog');
		const img = win.querySelector('img.image') as HTMLImageElement;
		vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({
			left: 0,
			top: 0,
			right: 200,
			bottom: 200,
			width: 200,
			height: 200,
			x: 0,
			y: 0,
			toJSON: () => ({})
		});

		await fireEvent.pointerDown(img, {
			pointerId: 11,
			pointerType: 'mouse',
			clientX: 50,
			clientY: 80
		});

		expect(onSampleStart).toHaveBeenCalledTimes(1);
		expect(onSampleStart).toHaveBeenCalledWith(ref.blob, 25, 40, 'mouse');
	});

	it('does not forward mouse pointerdown when quickSamplingEnabled is false', async () => {
		store = seedStore([{ ref: makeRef('ref-1'), geom: { x: 0, y: 0, width: 200, height: 200 } }]);
		const onSampleStart = vi.fn();

		render(ReferenceWindowOverlay, {
			store,
			docId: 'doc-1',
			viewportWidth: 1000,
			viewportHeight: 800,
			quickSamplingEnabled: false,
			onSampleStart
		});

		const win = screen.getByRole('dialog');
		const img = win.querySelector('img.image') as HTMLImageElement;
		vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({
			left: 0,
			top: 0,
			right: 200,
			bottom: 200,
			width: 200,
			height: 200,
			x: 0,
			y: 0,
			toJSON: () => ({})
		});

		await fireEvent.pointerDown(img, {
			pointerId: 12,
			pointerType: 'mouse',
			clientX: 50,
			clientY: 80
		});

		expect(onSampleStart).not.toHaveBeenCalled();
	});

	it('preserves the stored placement and uses it when the viewport is large again', () => {
		store = seedStore([
			{ ref: makeRef('ref-1'), geom: { x: 550, y: 350, width: 400, height: 300 } }
		]);

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
		const state = store.windowStateFor('ref-1', 'doc-1');
		expect(state).toMatchObject({ x: 550, y: 350, width: 400, height: 300 });
	});
});
