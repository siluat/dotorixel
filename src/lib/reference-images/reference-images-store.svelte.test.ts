// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFakeDirtyNotifier, type FakeDirtyNotifier } from '$lib/canvas/editor-session/fake-dirty-notifier';
import { ReferenceImagesStore } from './reference-images-store.svelte';
import * as singleImport from './import-reference-image';
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

		it('setDisplaySize updates width/height, preserves the rest, and marks the doc dirty', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 200 });
			notifier.reset();

			store.setDisplaySize('ref-1', 'doc-1', 250, 400);

			expect(store.displayStateFor('ref-1', 'doc-1')).toEqual({
				refId: 'ref-1',
				visible: true,
				x: 10,
				y: 20,
				width: 250,
				height: 400,
				minimized: false,
				zOrder: 1
			});
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});

		it('setDisplayPosition updates x/y, preserves the rest, and marks the doc dirty', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 200 });
			notifier.reset();

			store.setDisplayPosition('ref-1', 'doc-1', 300, 400);

			expect(store.displayStateFor('ref-1', 'doc-1')).toEqual({
				refId: 'ref-1',
				visible: true,
				x: 300,
				y: 400,
				width: 100,
				height: 200,
				minimized: false,
				zOrder: 1
			});
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});

		it('round-trips the minimized flag via displayStatesSnapshot and restoredDisplayStates', () => {
			const store1 = new ReferenceImagesStore({ notifier });
			store1.add(makeRef('ref-1'), 'doc-1');
			store1.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 200 });
			store1.setMinimized('ref-1', 'doc-1', true);

			const store2 = new ReferenceImagesStore({
				notifier,
				restored: store1.toSnapshot(),
				restoredDisplayStates: store1.displayStatesSnapshot()
			});

			expect(store2.displayStateFor('ref-1', 'doc-1')).toMatchObject({
				refId: 'ref-1',
				minimized: true
			});
		});

		it('setMinimized flips the minimized flag, preserves the rest, and marks the doc dirty', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 200 });
			notifier.reset();

			store.setMinimized('ref-1', 'doc-1', true);

			expect(store.displayStateFor('ref-1', 'doc-1')).toEqual({
				refId: 'ref-1',
				visible: true,
				x: 10,
				y: 20,
				width: 100,
				height: 200,
				minimized: true,
				zOrder: 1
			});
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});

		it('nextCascadeIndex returns 0 when no windows are visible', () => {
			const store = new ReferenceImagesStore({ notifier });

			expect(store.nextCascadeIndex('doc-1')).toBe(0);
		});

		it('nextCascadeIndex grows with each newly displayed window', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.add(makeRef('ref-2'), 'doc-1');

			store.display('ref-1', 'doc-1', { x: 0, y: 0, width: 100, height: 100 });
			expect(store.nextCascadeIndex('doc-1')).toBe(1);

			store.display('ref-2', 'doc-1', { x: 0, y: 0, width: 100, height: 100 });
			expect(store.nextCascadeIndex('doc-1')).toBe(2);
		});

		it('nextCascadeIndex resets to 0 once all visible windows are closed', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.add(makeRef('ref-2'), 'doc-1');
			store.display('ref-1', 'doc-1', { x: 0, y: 0, width: 100, height: 100 });
			store.display('ref-2', 'doc-1', { x: 0, y: 0, width: 100, height: 100 });

			store.close('ref-1', 'doc-1');
			store.close('ref-2', 'doc-1');

			expect(store.nextCascadeIndex('doc-1')).toBe(0);
		});

		it('nextCascadeIndex counts only currently visible windows, not closed ones', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.add(makeRef('ref-2'), 'doc-1');
			store.add(makeRef('ref-3'), 'doc-1');
			store.display('ref-1', 'doc-1', { x: 0, y: 0, width: 100, height: 100 });
			store.display('ref-2', 'doc-1', { x: 0, y: 0, width: 100, height: 100 });
			store.display('ref-3', 'doc-1', { x: 0, y: 0, width: 100, height: 100 });

			store.close('ref-2', 'doc-1');

			expect(store.nextCascadeIndex('doc-1')).toBe(2);
		});

		it('refitAll keeps the shrunk size after a viewport regrow (no auto-restoration)', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.display('ref-1', 'doc-1', { x: 0, y: 0, width: 800, height: 400 });

			store.refitAll('doc-1', { width: 400, height: 400 });
			const shrunk = store.displayStateFor('ref-1', 'doc-1')!;
			notifier.reset();

			store.refitAll('doc-1', { width: 1600, height: 1200 });

			expect(store.displayStateFor('ref-1', 'doc-1')).toEqual(shrunk);
			expect(notifier.dirtyCalls).toEqual([]);
		});

		it('refitAll fires one markDirty per actually-changed placement (dirty fan-out matches change count)', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.add(makeRef('ref-2'), 'doc-1');
			store.add(makeRef('ref-3'), 'doc-1');
			store.display('ref-1', 'doc-1', { x: 0, y: 0, width: 800, height: 400 });
			store.display('ref-2', 'doc-1', { x: 0, y: 0, width: 100, height: 100 });
			store.display('ref-3', 'doc-1', { x: 0, y: 0, width: 600, height: 300 });
			notifier.reset();

			store.refitAll('doc-1', { width: 400, height: 400 });

			expect(notifier.dirtyCalls).toEqual(['doc-1', 'doc-1']);
		});

		it('refitAll skips closed (invisible) placements and never resizes them', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.display('ref-1', 'doc-1', { x: 0, y: 0, width: 800, height: 400 });
			store.close('ref-1', 'doc-1');
			notifier.reset();

			store.refitAll('doc-1', { width: 400, height: 400 });

			expect(store.displayStateFor('ref-1', 'doc-1')).toMatchObject({
				visible: false,
				width: 800,
				height: 400
			});
			expect(notifier.dirtyCalls).toEqual([]);
		});

		it('refitAll shrinks an oversized visible placement (aspect-preserving) and fires markDirty for the changed one only', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.add(makeRef('ref-2'), 'doc-1');
			// Already fits — should not change.
			store.display('ref-1', 'doc-1', { x: 0, y: 0, width: 100, height: 100 });
			// Wider than the new viewport — must shrink, aspect-preserving.
			store.display('ref-2', 'doc-1', { x: 0, y: 0, width: 800, height: 400 });
			notifier.reset();

			store.refitAll('doc-1', { width: 400, height: 400 });

			const ref1 = store.displayStateFor('ref-1', 'doc-1');
			const ref2 = store.displayStateFor('ref-2', 'doc-1');
			expect(ref1).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
			expect(ref2!.width).toBeCloseTo(400, 5);
			expect(ref2!.height).toBeCloseTo(200, 5);
			expect(ref2!.width / ref2!.height).toBeCloseTo(2, 5);
			expect(notifier.dirtyCalls).toEqual(['doc-1']);
		});

		it('refitAll is a no-op (no markDirty, no state change) when every visible placement already fits the viewport', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.add(makeRef('ref-2'), 'doc-1');
			store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 80 });
			store.display('ref-2', 'doc-1', { x: 200, y: 300, width: 150, height: 100 });
			const before = store.displayStatesSnapshot();
			notifier.reset();

			store.refitAll('doc-1', { width: 1000, height: 800 });

			expect(store.displayStatesSnapshot()).toEqual(before);
			expect(notifier.dirtyCalls).toEqual([]);
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

	describe('importToGallery', () => {
		function makeFile(name: string, type = 'image/png'): File {
			return new File([new Uint8Array([0])], name, { type });
		}

		beforeEach(() => {
			vi.spyOn(singleImport, 'importReferenceImage').mockReset();
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('adds every successfully imported file to the doc in input order, with no display state', async () => {
			const store = new ReferenceImagesStore({ notifier });
			const refA = makeRef('a');
			const refB = makeRef('b');
			vi.spyOn(singleImport, 'importReferenceImage')
				.mockResolvedValueOnce({ ok: true, reference: refA })
				.mockResolvedValueOnce({ ok: true, reference: refB });

			const result = await store.importToGallery([makeFile('a.png'), makeFile('b.png')], 'doc-1');

			expect(store.forDoc('doc-1').map((r) => r.id)).toEqual(['a', 'b']);
			expect(store.displayStatesForDoc('doc-1')).toEqual([]);
			expect(result.errors).toEqual([]);
		});

		it('skips failed imports and surfaces them as typed errors paired with the source file', async () => {
			const store = new ReferenceImagesStore({ notifier });
			const valid = makeFile('keep.png');
			const oversize = makeFile('big.png');
			const unsupported = makeFile('weird.svg', 'image/svg+xml');
			vi.spyOn(singleImport, 'importReferenceImage')
				.mockResolvedValueOnce({ ok: true, reference: makeRef('keep') })
				.mockResolvedValueOnce({ ok: false, error: { kind: 'too-large' } })
				.mockResolvedValueOnce({ ok: false, error: { kind: 'unsupported-format' } });

			const result = await store.importToGallery([valid, oversize, unsupported], 'doc-1');

			expect(store.forDoc('doc-1').map((r) => r.id)).toEqual(['keep']);
			expect(result.errors).toEqual([
				{ file: oversize, error: { kind: 'too-large' } },
				{ file: unsupported, error: { kind: 'unsupported-format' } }
			]);
		});
	});

	describe('importDroppedBatch', () => {
		function makeFile(name: string, type = 'image/png'): File {
			return new File([new Uint8Array([0])], name, { type });
		}

		const VIEWPORT = { width: 1000, height: 800 };

		beforeEach(() => {
			vi.spyOn(singleImport, 'importReferenceImage').mockReset();
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('places successive references along an intra-batch cascade from the drop anchor (24px down-right per index)', async () => {
			const store = new ReferenceImagesStore({ notifier });
			const refA = makeRef('a');
			const refB = makeRef('b');
			vi.spyOn(singleImport, 'importReferenceImage')
				.mockResolvedValueOnce({ ok: true, reference: refA })
				.mockResolvedValueOnce({ ok: true, reference: refB });

			await store.importDroppedBatch(
				[makeFile('a.png'), makeFile('b.png')],
				'doc-1',
				{ x: 500, y: 400 },
				VIEWPORT
			);

			const sA = store.displayStateFor('a', 'doc-1')!;
			const sB = store.displayStateFor('b', 'doc-1')!;
			expect(sA).toBeDefined();
			expect(sB).toBeDefined();
			expect(sB.x - sA.x).toBe(24);
			expect(sB.y - sA.y).toBe(24);
		});

		it('does not advance the document cascade index — at-point intents bypass the cascade slot', async () => {
			const store = new ReferenceImagesStore({ notifier });
			vi.spyOn(singleImport, 'importReferenceImage')
				.mockResolvedValueOnce({ ok: true, reference: makeRef('a') })
				.mockResolvedValueOnce({ ok: true, reference: makeRef('b') });

			await store.importDroppedBatch(
				[makeFile('a.png'), makeFile('b.png')],
				'doc-1',
				{ x: 500, y: 400 },
				VIEWPORT
			);
			// Both windows are visible — but the cascade index must reflect them
			// only because they hold visible display state, not because the
			// at-point path "consumed" cascade slots. This test asserts the
			// path doesn't trigger any centered-cascade behaviour.
			expect(store.nextCascadeIndex('doc-1')).toBe(2); // visible-window count
		});

		it('skips failed imports — they get neither a reference entry nor a display state, but errors propagate', async () => {
			const store = new ReferenceImagesStore({ notifier });
			const ok = makeFile('ok.png');
			const bad = makeFile('bad.png');
			vi.spyOn(singleImport, 'importReferenceImage')
				.mockResolvedValueOnce({ ok: true, reference: makeRef('ok') })
				.mockResolvedValueOnce({ ok: false, error: { kind: 'decode-failed' } });

			const result = await store.importDroppedBatch(
				[ok, bad],
				'doc-1',
				{ x: 100, y: 100 },
				VIEWPORT
			);

			expect(store.forDoc('doc-1').map((r) => r.id)).toEqual(['ok']);
			expect(store.displayStatesForDoc('doc-1').map((s) => s.refId)).toEqual(['ok']);
			expect(result.errors).toEqual([{ file: bad, error: { kind: 'decode-failed' } }]);
		});
	});

	describe('openCentered', () => {
		const VIEWPORT = { width: 1000, height: 800 };

		it('raises an already-visible reference to the top z-order, leaving it visible', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('a'), 'doc-1');
			store.add(makeRef('b'), 'doc-1');
			store.display('a', 'doc-1', { x: 0, y: 0, width: 100, height: 100 });
			store.display('b', 'doc-1', { x: 0, y: 0, width: 100, height: 100 });
			const aBefore = store.displayStateFor('a', 'doc-1')!;
			const bZ = store.displayStateFor('b', 'doc-1')!.zOrder;

			store.openCentered('a', 'doc-1', VIEWPORT);

			const aAfter = store.displayStateFor('a', 'doc-1')!;
			expect(aAfter.visible).toBe(true);
			expect(aAfter.zOrder).toBeGreaterThan(bZ);
			expect(aAfter.zOrder).toBeGreaterThan(aBefore.zOrder);
		});

		it('reopens a hidden (visible=false) reference and raises it to the top z-order', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('a'), 'doc-1');
			store.display('a', 'doc-1', { x: 10, y: 20, width: 100, height: 100 });
			store.close('a', 'doc-1');

			store.openCentered('a', 'doc-1', VIEWPORT);

			const after = store.displayStateFor('a', 'doc-1')!;
			expect(after.visible).toBe(true);
			expect(after.x).toBe(10); // existing geometry preserved (no fresh placement)
			expect(after.y).toBe(20);
		});

		it('creates a fresh centered placement for a never-shown reference, consuming the doc cascade slot', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('a'), 'doc-1');
			store.add(makeRef('b'), 'doc-1');

			store.openCentered('a', 'doc-1', VIEWPORT);
			store.openCentered('b', 'doc-1', VIEWPORT);

			const a = store.displayStateFor('a', 'doc-1')!;
			const b = store.displayStateFor('b', 'doc-1')!;
			expect(a).toBeDefined();
			expect(b).toBeDefined();
			expect(b.x - a.x).toBe(24); // centered cascade offset
			expect(b.y - a.y).toBe(24);
		});
	});

	describe('toggleDisplay', () => {
		const VIEWPORT = { width: 1000, height: 800 };

		it('hides a currently visible reference', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('a'), 'doc-1');
			store.display('a', 'doc-1', { x: 10, y: 20, width: 100, height: 100 });

			store.toggleDisplay('a', 'doc-1', VIEWPORT);

			expect(store.displayStateFor('a', 'doc-1')!.visible).toBe(false);
		});

		it('reopens a hidden reference and raises it to the top z-order', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('a'), 'doc-1');
			store.add(makeRef('b'), 'doc-1');
			store.display('a', 'doc-1', { x: 10, y: 20, width: 100, height: 100 });
			store.display('b', 'doc-1', { x: 0, y: 0, width: 100, height: 100 });
			store.close('a', 'doc-1');
			const bZ = store.displayStateFor('b', 'doc-1')!.zOrder;

			store.toggleDisplay('a', 'doc-1', VIEWPORT);

			const after = store.displayStateFor('a', 'doc-1')!;
			expect(after.visible).toBe(true);
			expect(after.x).toBe(10); // existing geometry preserved
			expect(after.zOrder).toBeGreaterThan(bZ);
		});

		it('creates a fresh centered placement for a never-shown reference (preserves "first toggle opens" UX)', () => {
			const store = new ReferenceImagesStore({ notifier });
			store.add(makeRef('a'), 'doc-1');

			store.toggleDisplay('a', 'doc-1', VIEWPORT);

			const after = store.displayStateFor('a', 'doc-1');
			expect(after).toBeDefined();
			expect(after!.visible).toBe(true);
		});
	});
});
