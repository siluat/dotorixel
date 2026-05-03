// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFakeDirtyNotifier, type FakeDirtyNotifier } from '$lib/canvas/editor-session/fake-dirty-notifier';
import { References } from './references.svelte';
import type { ReferenceImage } from './reference-image-types';

type ImportedShape = { width: number; height: number };

function installFakeImageDecoding(shapes: ImportedShape[] | (() => ImportedShape[])) {
	const queue = typeof shapes === 'function' ? shapes() : shapes.slice();
	vi.stubGlobal(
		'createImageBitmap',
		vi.fn(async () => {
			const next = queue.shift();
			if (!next) throw new Error('no fake bitmap remaining');
			return {
				width: next.width,
				height: next.height,
				close: () => {}
			} as ImageBitmap;
		})
	);
	vi.stubGlobal(
		'OffscreenCanvas',
		class FakeOffscreenCanvas {
			constructor(
				public width: number,
				public height: number
			) {}
			getContext() {
				return { drawImage: () => {} };
			}
			convertToBlob() {
				return Promise.resolve(new Blob([new Uint8Array([0])], { type: 'image/png' }));
			}
		}
	);
}

function installDecodeFailure() {
	vi.stubGlobal(
		'createImageBitmap',
		vi.fn(async () => {
			throw new Error('boom');
		})
	);
}

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

describe('References', () => {
	let notifier: FakeDirtyNotifier;

	beforeEach(() => {
		notifier = createFakeDirtyNotifier();
	});

	it('returns an empty list for a doc that has no references', () => {
		const store = new References({ notifier });

		expect(store.forDoc('doc-1')).toEqual([]);
	});

	it('returns added references for the doc and marks the doc dirty', () => {
		const store = new References({ notifier });
		const ref = makeRef('ref-1');

		store.add(ref, 'doc-1');

		expect(store.forDoc('doc-1')).toEqual([ref]);
		expect(notifier.dirtyCalls).toEqual(['doc-1']);
	});

	it('keeps references isolated per doc', () => {
		const store = new References({ notifier });
		const refA = makeRef('ref-a');
		const refB = makeRef('ref-b');

		store.add(refA, 'doc-1');
		store.add(refB, 'doc-2');

		expect(store.forDoc('doc-1')).toEqual([refA]);
		expect(store.forDoc('doc-2')).toEqual([refB]);
	});

	it('deletes a reference by id and marks the doc dirty', () => {
		const store = new References({ notifier });
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
		const store = new References({ notifier });
		store.add(makeRef('ref-a'), 'doc-1');
		const refB = makeRef('ref-b');
		store.add(refB, 'doc-2');

		store.removeDoc('doc-1');

		expect(store.forDoc('doc-1')).toEqual([]);
		expect(store.forDoc('doc-2')).toEqual([refB]);
	});

	it('exports a snapshot of all docs', () => {
		const store = new References({ notifier });
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
			const store = new References({ notifier });
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
			const store = new References({ notifier });
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
			const store1 = new References({ notifier });
			store1.add(makeRef('ref-1'), 'doc-1');
			store1.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 200 });
			store1.close('ref-1', 'doc-1');

			const store2 = new References({
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
			const store = new References({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');

			expect(store.displayStateFor('ref-1', 'doc-1')).toBeUndefined();

			store.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 200 });

			expect(store.displayStateFor('ref-1', 'doc-1')).toMatchObject({
				refId: 'ref-1',
				visible: true
			});
		});

		it('removeDoc clears references and displayStates for that doc', () => {
			const store = new References({ notifier });
			store.add(makeRef('ref-1'), 'doc-1');
			store.display('ref-1', 'doc-1', { x: 0, y: 0, width: 100, height: 100 });

			store.removeDoc('doc-1');

			expect(store.forDoc('doc-1')).toEqual([]);
			expect(store.displayStatesForDoc('doc-1')).toEqual([]);
		});

		it('delete removes the reference and its DisplayState together', () => {
			const store = new References({ notifier });
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
			const store = new References({ notifier });
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
			const store = new References({ notifier });
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
			const store1 = new References({ notifier });
			store1.add(makeRef('ref-1'), 'doc-1');
			store1.display('ref-1', 'doc-1', { x: 10, y: 20, width: 100, height: 200 });
			store1.setMinimized('ref-1', 'doc-1', true);

			const store2 = new References({
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
			const store = new References({ notifier });
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

		it('refitAll keeps the shrunk size after a viewport regrow (no auto-restoration)', () => {
			const store = new References({ notifier });
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
			const store = new References({ notifier });
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
			const store = new References({ notifier });
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
			const store = new References({ notifier });
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
			const store = new References({ notifier });
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
			const store = new References({ notifier });
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
		function makeFile(name: string, type = 'image/png', size = 1): File {
			return new File([new Uint8Array(size)], name, { type });
		}

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it('decodes and adds every valid file to the doc in input order, with no display state', async () => {
			installFakeImageDecoding([
				{ width: 100, height: 50 },
				{ width: 200, height: 80 }
			]);
			const store = new References({ notifier });

			const result = await store.importToGallery(
				[makeFile('a.png'), makeFile('b.png')],
				'doc-1'
			);

			const refs = store.forDoc('doc-1');
			expect(refs.map((r) => r.filename)).toEqual(['a.png', 'b.png']);
			expect(refs[0].naturalWidth).toBe(100);
			expect(refs[1].naturalWidth).toBe(200);
			expect(store.displayStatesForDoc('doc-1')).toEqual([]);
			expect(result.errors).toEqual([]);
		});

		it('keeps valid files and surfaces validation failures as typed errors paired with the source file', async () => {
			installFakeImageDecoding([{ width: 100, height: 100 }]);
			const store = new References({ notifier });
			const valid = makeFile('keep.png');
			const oversize = makeFile('big.png', 'image/png', 10 * 1024 * 1024 + 1);
			const unsupported = makeFile('weird.svg', 'image/svg+xml');

			const result = await store.importToGallery([valid, oversize, unsupported], 'doc-1');

			expect(store.forDoc('doc-1').map((r) => r.filename)).toEqual(['keep.png']);
			expect(result.errors).toEqual([
				{ file: oversize, error: { kind: 'too-large' } },
				{ file: unsupported, error: { kind: 'unsupported-format' } }
			]);
		});

		it('rejects an SVG file with unsupported-format before touching the decoder', async () => {
			const store = new References({ notifier });
			const svg = makeFile('weird.svg', 'image/svg+xml');

			const result = await store.importToGallery([svg], 'doc-1');

			expect(store.forDoc('doc-1')).toEqual([]);
			expect(result.errors).toEqual([{ file: svg, error: { kind: 'unsupported-format' } }]);
		});

		it('rejects a >10MB file with too-large before touching the decoder', async () => {
			const store = new References({ notifier });
			const big = makeFile('big.png', 'image/png', 10 * 1024 * 1024 + 1);

			const result = await store.importToGallery([big], 'doc-1');

			expect(store.forDoc('doc-1')).toEqual([]);
			expect(result.errors).toEqual([{ file: big, error: { kind: 'too-large' } }]);
		});

		it('surfaces decode-failed when the decoder throws', async () => {
			installDecodeFailure();
			const store = new References({ notifier });
			const file = makeFile('broken.png');

			const result = await store.importToGallery([file], 'doc-1');

			expect(store.forDoc('doc-1')).toEqual([]);
			expect(result.errors).toEqual([{ file, error: { kind: 'decode-failed' } }]);
		});
	});

	describe('importDroppedBatch', () => {
		function makeFile(name: string, type = 'image/png'): File {
			return new File([new Uint8Array([0])], name, { type });
		}

		const VIEWPORT = { width: 1000, height: 800 };

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it('places successive references along an intra-batch cascade from the drop anchor (24px down-right per index)', async () => {
			installFakeImageDecoding([
				{ width: 100, height: 100 },
				{ width: 100, height: 100 }
			]);
			const store = new References({ notifier });

			await store.importDroppedBatch(
				[makeFile('a.png'), makeFile('b.png')],
				'doc-1',
				{ x: 500, y: 400 },
				VIEWPORT
			);

			const refs = store.forDoc('doc-1');
			expect(refs.length).toBe(2);
			const sA = store.displayStateFor(refs[0].id, 'doc-1')!;
			const sB = store.displayStateFor(refs[1].id, 'doc-1')!;
			expect(sA).toBeDefined();
			expect(sB).toBeDefined();
			expect(sB.x - sA.x).toBe(24);
			expect(sB.y - sA.y).toBe(24);
		});

		it('places every successful import — failed ones are skipped from display, errors propagate', async () => {
			installFakeImageDecoding([{ width: 100, height: 100 }]);
			const store = new References({ notifier });
			const ok = makeFile('ok.png');
			const bad = makeFile('bad.svg', 'image/svg+xml');

			const result = await store.importDroppedBatch(
				[ok, bad],
				'doc-1',
				{ x: 100, y: 100 },
				VIEWPORT
			);

			const refs = store.forDoc('doc-1');
			expect(refs.map((r) => r.filename)).toEqual(['ok.png']);
			expect(store.displayStatesForDoc('doc-1').map((s) => s.refId)).toEqual([refs[0].id]);
			expect(result.errors).toEqual([{ file: bad, error: { kind: 'unsupported-format' } }]);
		});

		it('does not consume the document centered-cascade slot — the next centered open opens at index 0 after dismissals', async () => {
			installFakeImageDecoding([
				{ width: 100, height: 100 },
				{ width: 100, height: 100 }
			]);
			const store = new References({ notifier });

			await store.importDroppedBatch(
				[makeFile('a.png'), makeFile('b.png')],
				'doc-1',
				{ x: 500, y: 400 },
				VIEWPORT
			);
			// Dismiss everything dropped — the centered-cascade slot should
			// behave as if no centered placement had ever been recorded.
			for (const ref of store.forDoc('doc-1')) {
				store.close(ref.id, 'doc-1');
			}
			// Now drop a third reference and open it centered — its
			// placement should be at the cascade-0 position (i.e. exactly
			// matches a fresh centered placement on an empty doc).
			vi.unstubAllGlobals();
			installFakeImageDecoding([{ width: 100, height: 100 }]);
			await store.importToGallery([makeFile('c.png')], 'doc-1');
			const c = store.forDoc('doc-1').find((r) => r.filename === 'c.png')!;

			store.openCentered(c.id, 'doc-1', VIEWPORT);

			const cState = store.displayStateFor(c.id, 'doc-1')!;
			// At index 0 the placement is viewport-centered exactly: x = (w - 100)/2.
			expect(cState.x).toBe((VIEWPORT.width - 100) / 2);
			expect(cState.y).toBe((VIEWPORT.height - 100) / 2);
		});
	});

	describe('openCentered', () => {
		const VIEWPORT = { width: 1000, height: 800 };

		it('raises an already-visible reference to the top z-order, leaving it visible', () => {
			const store = new References({ notifier });
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
			const store = new References({ notifier });
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
			const store = new References({ notifier });
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
			const store = new References({ notifier });
			store.add(makeRef('a'), 'doc-1');
			store.display('a', 'doc-1', { x: 10, y: 20, width: 100, height: 100 });

			store.toggleDisplay('a', 'doc-1', VIEWPORT);

			expect(store.displayStateFor('a', 'doc-1')!.visible).toBe(false);
		});

		it('reopens a hidden reference and raises it to the top z-order', () => {
			const store = new References({ notifier });
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
			const store = new References({ notifier });
			store.add(makeRef('a'), 'doc-1');

			store.toggleDisplay('a', 'doc-1', VIEWPORT);

			const after = store.displayStateFor('a', 'doc-1');
			expect(after).toBeDefined();
			expect(after!.visible).toBe(true);
		});
	});
});
