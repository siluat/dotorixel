// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { createFakeDirtyNotifier, type FakeDirtyNotifier } from '$lib/canvas/editor-session/fake-dirty-notifier';
import { ReferenceImagesStore } from './reference-images-store.svelte';
import type { ReferenceImage } from './reference-image-types';

function makeRef(id: string, filename = `${id}.png`): ReferenceImage {
	return {
		id,
		filename,
		blob: new Blob([new Uint8Array([0])], { type: 'image/png' }),
		thumbnail: new Blob([new Uint8Array([0])], { type: 'image/png' }),
		mimeType: 'image/png',
		naturalWidth: 100,
		naturalHeight: 100,
		byteSize: 1,
		addedAt: new Date('2026-04-26T00:00:00Z')
	};
}

describe('ReferenceImagesStore', () => {
	let notifier: FakeDirtyNotifier;

	beforeEach(() => {
		notifier = createFakeDirtyNotifier();
	});

	it('returns an empty list for a doc that has no references', () => {
		const store = new ReferenceImagesStore({ notifier });

		expect(store.forDoc('doc-1')).toEqual([]);
	});

	it('returns added references for the doc and marks the doc dirty', () => {
		const store = new ReferenceImagesStore({ notifier });
		const ref = makeRef('ref-1');

		store.add(ref, 'doc-1');

		expect(store.forDoc('doc-1')).toEqual([ref]);
		expect(notifier.dirtyCalls).toEqual(['doc-1']);
	});

	it('keeps references isolated per doc', () => {
		const store = new ReferenceImagesStore({ notifier });
		const refA = makeRef('ref-a');
		const refB = makeRef('ref-b');

		store.add(refA, 'doc-1');
		store.add(refB, 'doc-2');

		expect(store.forDoc('doc-1')).toEqual([refA]);
		expect(store.forDoc('doc-2')).toEqual([refB]);
	});

	it('deletes a reference by id and marks the doc dirty', () => {
		const store = new ReferenceImagesStore({ notifier });
		const refA = makeRef('ref-a');
		const refB = makeRef('ref-b');
		store.add(refA, 'doc-1');
		store.add(refB, 'doc-1');
		notifier.reset();

		store.delete('ref-a', 'doc-1');

		expect(store.forDoc('doc-1')).toEqual([refB]);
		expect(notifier.dirtyCalls).toEqual(['doc-1']);
	});

	it('removes all references for a doc on removeDoc, leaving other docs intact', () => {
		const store = new ReferenceImagesStore({ notifier });
		store.add(makeRef('ref-a'), 'doc-1');
		const refB = makeRef('ref-b');
		store.add(refB, 'doc-2');

		store.removeDoc('doc-1');

		expect(store.forDoc('doc-1')).toEqual([]);
		expect(store.forDoc('doc-2')).toEqual([refB]);
	});

	it('exports a snapshot of all docs', () => {
		const store = new ReferenceImagesStore({ notifier });
		const refA = makeRef('ref-a');
		const refB = makeRef('ref-b');
		store.add(refA, 'doc-1');
		store.add(refB, 'doc-2');

		expect(store.toSnapshot()).toEqual({
			'doc-1': [refA],
			'doc-2': [refB]
		});
	});
});
