// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFakeDirtyNotifier } from '$lib/canvas/editor-session/fake-dirty-notifier';
import { ReferenceImagesStore } from './reference-images-store.svelte';
import type { ReferenceImage } from './reference-image-types';
import { selectReference, displayReference } from './select-reference';

function makeRef(id: string, filename = `${id}.png`): ReferenceImage {
	return {
		id,
		filename,
		blob: new Blob([new Uint8Array([0])], { type: 'image/png' }),
		thumbnail: new Blob([new Uint8Array([0])], { type: 'image/png' }),
		mimeType: 'image/png',
		naturalWidth: 200,
		naturalHeight: 100,
		byteSize: 1,
		addedAt: new Date('2026-04-26T00:00:00Z')
	};
}

const VIEWPORT = { width: 1000, height: 800 };

describe('selectReference', () => {
	let store: ReferenceImagesStore;

	beforeEach(() => {
		store = new ReferenceImagesStore({ notifier: createFakeDirtyNotifier() });
	});

	it('raises an already-displayed reference and closes the modal', () => {
		const ref = makeRef('ref-1');
		store.add(ref, 'doc-1');
		store.display(ref.id, 'doc-1', { x: 0, y: 0, width: 100, height: 100 });
		const initialZ = store.displayStateFor(ref.id, 'doc-1')?.zOrder ?? 0;
		const onClose = vi.fn();

		selectReference({ store, docId: 'doc-1', ref, viewport: VIEWPORT, onClose });

		const after = store.displayStateFor(ref.id, 'doc-1');
		expect(after?.zOrder).toBeGreaterThan(initialZ);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('raises a closed reference (visible=false) and closes the modal', () => {
		const ref = makeRef('ref-1');
		store.add(ref, 'doc-1');
		store.display(ref.id, 'doc-1', { x: 0, y: 0, width: 100, height: 100 });
		store.close(ref.id, 'doc-1');
		const onClose = vi.fn();

		selectReference({ store, docId: 'doc-1', ref, viewport: VIEWPORT, onClose });

		const after = store.displayStateFor(ref.id, 'doc-1');
		expect(after?.visible).toBe(true);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('creates a fresh display state for a never-shown reference and closes the modal', () => {
		const ref = makeRef('ref-1');
		store.add(ref, 'doc-1');
		const onClose = vi.fn();

		selectReference({ store, docId: 'doc-1', ref, viewport: VIEWPORT, onClose });

		const after = store.displayStateFor(ref.id, 'doc-1');
		expect(after).toBeDefined();
		expect(after?.visible).toBe(true);
		expect(onClose).toHaveBeenCalledOnce();
	});
});

describe('displayReference', () => {
	let store: ReferenceImagesStore;

	beforeEach(() => {
		store = new ReferenceImagesStore({ notifier: createFakeDirtyNotifier() });
	});

	it('uses nextCascadeIndex so the second window is offset 24px down-right of the first', () => {
		const ref1 = makeRef('ref-1');
		const ref2 = makeRef('ref-2');
		store.add(ref1, 'doc-1');
		store.add(ref2, 'doc-1');

		displayReference({ store, docId: 'doc-1', ref: ref1, viewport: VIEWPORT });
		displayReference({ store, docId: 'doc-1', ref: ref2, viewport: VIEWPORT });

		const s1 = store.displayStateFor(ref1.id, 'doc-1')!;
		const s2 = store.displayStateFor(ref2.id, 'doc-1')!;
		expect(s2.x - s1.x).toBe(24);
		expect(s2.y - s1.y).toBe(24);
	});

	it('resets cascade to viewport-center after all open windows are closed', () => {
		const ref1 = makeRef('ref-1');
		const ref2 = makeRef('ref-2');
		const ref3 = makeRef('ref-3');
		store.add(ref1, 'doc-1');
		store.add(ref2, 'doc-1');
		store.add(ref3, 'doc-1');
		displayReference({ store, docId: 'doc-1', ref: ref1, viewport: VIEWPORT });
		displayReference({ store, docId: 'doc-1', ref: ref2, viewport: VIEWPORT });
		store.close(ref1.id, 'doc-1');
		store.close(ref2.id, 'doc-1');

		displayReference({ store, docId: 'doc-1', ref: ref3, viewport: VIEWPORT });

		const s1 = store.displayStateFor(ref1.id, 'doc-1')!;
		const s3 = store.displayStateFor(ref3.id, 'doc-1')!;
		expect(s3.x).toBe(s1.x);
		expect(s3.y).toBe(s1.y);
	});

	it('clamps zero/negative viewport dimensions to at least 1px before computing placement', () => {
		const ref = makeRef('ref-1');
		store.add(ref, 'doc-1');

		displayReference({ store, docId: 'doc-1', ref, viewport: { width: 0, height: 0 } });

		const state = store.displayStateFor(ref.id, 'doc-1');
		expect(state).toBeDefined();
		expect(Number.isFinite(state!.x)).toBe(true);
		expect(Number.isFinite(state!.y)).toBe(true);
	});
});
