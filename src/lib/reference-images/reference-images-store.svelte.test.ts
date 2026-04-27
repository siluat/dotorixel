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

	describe('display states', () => {
		it('creates a visible DisplayState on display, with zOrder, and marks the doc dirty', () => {
			const store = new ReferenceImagesStore({ notifier });
			const ref = makeRef('ref-1');
			store.add(ref, 'doc-1');
			notifier.reset();

			store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 200 });

			expect(store.displayStatesForDoc('doc-1')).toEqual([
				{
					refId: 'ref-1',
					visible: true,
					x: 10,
					y: 20,
					width: 100,
					height: 200,
					minimized: false,
					zOrder: 1
				}
			]);
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});

		it('show flips visible back to true, preserves x/y/w/h, and bumps zOrder above the current max', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.add(makeRef('ref-2'), 'doc-1');
			store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 200 });
			store.close('ref-1', 'doc-1');
			store.display('ref-2', 'doc-1', { x: 50, y: 60, width: 80, height: 80 });
			notifier.reset();

			store.show('ref-1', 'doc-1');

			const states = store.displayStatesForDoc('doc-1');
			const ref1 = states.find((s) => s.refId === 'ref-1');
			expect(ref1).toEqual({
				refId: 'ref-1',
				visible: true,
				x: 10,
				y: 20,
				width: 100,
				height: 200,
				minimized: false,
				zOrder: 3
			});
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});

		it('round-trips displayStates via displayStatesSnapshot and restoredDisplayStates', () => {
			const store1 = new ReferenceImagesStore({ notifier });
			store1.add(makeRef('ref-1'), 'doc-1');
			store1.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 200 });
			store1.close('ref-1', 'doc-1');

			const store2 = new ReferenceImagesStore({
				notifier,
				restored: store1.toSnapshot(),
				restoredDisplayStates: store1.displayStatesSnapshot()
			});

			expect(store2.displayStatesForDoc('doc-1')).toEqual([
				{
					refId: 'ref-1',
					visible: false,
					x: 10,
					y: 20,
					width: 100,
					height: 200,
					minimized: false,
					zOrder: 1
				}
			]);
		});

		it('displayStateFor returns undefined when absent, the DisplayState when present', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');

			expect(store.displayStateFor('ref-1', 'doc-1')).toBeUndefined();

			store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 200 });

			expect(store.displayStateFor('ref-1', 'doc-1')).toMatchObject({
				refId: 'ref-1',
				visible: true
			});
		});

		it('removeDoc clears references and displayStates for that doc', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.display('ref-1', 'doc-1', { x: 0, y: 0, width: 100, height: 100 });

			store.removeDoc('doc-1');

			expect(store.forDoc('doc-1')).toEqual([]);
			expect(store.displayStatesForDoc('doc-1')).toEqual([]);
		});

		it('delete removes the reference and its DisplayState together', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.add(makeRef('ref-2'), 'doc-1');
			store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 200 });
			store.display('ref-2', 'doc-1', { x: 50, y: 60, width: 80, height: 80 });
			notifier.reset();

			store.delete('ref-1', 'doc-1');

			expect(store.forDoc('doc-1').map((r) => r.id)).toEqual(['ref-2']);
			expect(store.displayStatesForDoc('doc-1').map((s) => s.refId)).toEqual(['ref-2']);
		});

		it('flips visible to false on close, preserving x/y/w/h and zOrder', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 200 });
			notifier.reset();

			store.close('ref-1', 'doc-1');

			expect(store.displayStatesForDoc('doc-1')).toEqual([
				{
					refId: 'ref-1',
					visible: false,
					x: 10,
					y: 20,
					width: 100,
					height: 200,
					minimized: false,
					zOrder: 1
				}
			]);
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});
	});
});
