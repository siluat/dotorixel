// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
	createReferenceSamplingSession,
	type ReferenceSamplingSessionDeps
} from './reference-sampling-session.svelte';
import type { Color } from '../canvas/color';
import type { DecodedImage } from './sample-pixel';

const CENTER_INDEX = 40; // (9*9 - 1) / 2

const RED: Color = { r: 255, g: 0, b: 0, a: 255 };

const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });

/** Build a `DecodedImage` whose pixels at integer coords are derived from a function. */
function decodedImageBy(
	width: number,
	height: number,
	color: (x: number, y: number) => Color
): DecodedImage {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const c = color(x, y);
			const i = (y * width + x) * 4;
			data[i] = c.r;
			data[i + 1] = c.g;
			data[i + 2] = c.b;
			data[i + 3] = c.a;
		}
	}
	return { width, height, data };
}

/** Inject a decode port whose result is queued via the returned `enqueue` function. */
function withQueuedDecodes(): {
	deps: ReferenceSamplingSessionDeps;
	enqueueResolved: (image: DecodedImage) => void;
	enqueueDeferred: () => { resolve: (image: DecodedImage) => void; reject: (err: Error) => void };
	enqueueRejected: (err: Error) => void;
} {
	const queue: Array<() => Promise<DecodedImage>> = [];
	return {
		deps: {
			decode: () => {
				const next = queue.shift();
				if (!next) throw new Error('decode called more times than enqueued');
				return next();
			}
		},
		enqueueResolved(image) {
			queue.push(() => Promise.resolve(image));
		},
		enqueueDeferred() {
			let resolveFn!: (image: DecodedImage) => void;
			let rejectFn!: (err: Error) => void;
			queue.push(
				() =>
					new Promise<DecodedImage>((resolve, reject) => {
						resolveFn = resolve;
						rejectFn = reject;
					})
			);
			return {
				resolve: (image) => resolveFn(image),
				reject: (err) => rejectFn(err)
			};
		},
		enqueueRejected(err) {
			queue.push(() => Promise.reject(err));
		}
	};
}

describe('ReferenceSamplingSession', () => {
	it('start activates the session with a grid centered on the given coords', async () => {
		const { deps, enqueueResolved } = withQueuedDecodes();
		enqueueResolved(decodedImageBy(9, 9, () => RED));
		const session = createReferenceSamplingSession(deps);

		await session.start(blob, { x: 4, y: 4 }, 'touch');

		expect(session.isActive).toBe(true);
		expect(session.grid).toHaveLength(81);
		expect(session.grid[CENTER_INDEX]).toEqual(RED);
	});

	it('move re-samples the grid around the new coords using the cached decode and returns a preview effect', async () => {
		const BLUE: Color = { r: 0, g: 0, b: 255, a: 255 };
		const { deps, enqueueResolved } = withQueuedDecodes();
		// 16×16 split image: x<8 red, x>=8 blue. Decode is enqueued exactly once
		// — if move tried to re-decode, the next call would throw.
		enqueueResolved(decodedImageBy(16, 16, (x) => (x < 8 ? RED : BLUE)));
		const session = createReferenceSamplingSession(deps);

		await session.start(blob, { x: 4, y: 8 }, 'touch');
		expect(session.grid[CENTER_INDEX]).toEqual(RED);

		const effects = session.move({ x: 12, y: 8 });

		expect(session.grid[CENTER_INDEX]).toEqual(BLUE);
		expect(effects).toEqual([{ type: 'colorPick', target: 'foreground', color: BLUE }]);
	});

	it('start returns a foreground preview effect (no recent-color yet)', async () => {
		const SAMPLED: Color = { r: 12, g: 34, b: 56, a: 255 };
		const { deps, enqueueResolved } = withQueuedDecodes();
		enqueueResolved(decodedImageBy(9, 9, () => SAMPLED));
		const session = createReferenceSamplingSession(deps);

		const effects = await session.start(blob, { x: 4, y: 4 }, 'touch');

		expect(effects).toEqual([{ type: 'colorPick', target: 'foreground', color: SAMPLED }]);
	});

	it('end on a transparent center pixel deactivates without committing', async () => {
		const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };
		const { deps, enqueueResolved } = withQueuedDecodes();
		enqueueResolved(decodedImageBy(9, 9, () => TRANSPARENT));
		const session = createReferenceSamplingSession(deps);

		await session.start(blob, { x: 4, y: 4 }, 'touch');
		const effects = session.end();

		expect(session.isActive).toBe(false);
		expect(effects).toEqual([]);
	});

	it('end deactivates the session and commits foreground + recent-color on the centered pixel', async () => {
		const SAMPLED: Color = { r: 12, g: 34, b: 56, a: 255 };
		const { deps, enqueueResolved } = withQueuedDecodes();
		enqueueResolved(decodedImageBy(9, 9, () => SAMPLED));
		const session = createReferenceSamplingSession(deps);

		await session.start(blob, { x: 4, y: 4 }, 'touch');
		const effects = session.end();

		expect(session.isActive).toBe(false);
		expect(effects).toEqual([
			{ type: 'colorPick', target: 'foreground', color: SAMPLED },
			{ type: 'addRecentColor', hex: '#0c2238' }
		]);
	});

	it('release before decode resolves: start() resolves with commit effects (pending-commit)', async () => {
		const SAMPLED: Color = { r: 12, g: 34, b: 56, a: 255 };
		const { deps, enqueueDeferred } = withQueuedDecodes();
		const decode = enqueueDeferred();
		const session = createReferenceSamplingSession(deps);

		const startPromise = session.start(blob, { x: 4, y: 4 }, 'mouse');
		const endEffects = session.end();
		decode.resolve(decodedImageBy(9, 9, () => SAMPLED));
		const startEffects = await startPromise;

		expect(session.isActive).toBe(false);
		expect(endEffects).toEqual([]);
		expect(startEffects).toEqual([
			{ type: 'colorPick', target: 'foreground', color: SAMPLED },
			{ type: 'addRecentColor', hex: '#0c2238' }
		]);
	});

	it('decode failure leaves the session inactive and returns no effects', async () => {
		const { deps, enqueueRejected } = withQueuedDecodes();
		enqueueRejected(new Error('decode failed'));
		const session = createReferenceSamplingSession(deps);

		const effects = await session.start(blob, { x: 4, y: 4 }, 'touch');

		expect(session.isActive).toBe(false);
		expect(effects).toEqual([]);
	});

	it('a new start discards an in-flight superseded decode and any prior pending-commit', async () => {
		// Click 1: start (decode pending) → end (pending-commit set).
		// Click 2: start with a fast decode — must NOT inherit click 1's pending,
		// and the late slow decode from click 1 must NOT clobber click 2's port.
		const BLUE: Color = { r: 0, g: 0, b: 255, a: 255 };
		const { deps, enqueueDeferred, enqueueResolved } = withQueuedDecodes();
		const slow = enqueueDeferred();
		enqueueResolved(decodedImageBy(9, 9, () => BLUE));
		const session = createReferenceSamplingSession(deps);

		const first = session.start(blob, { x: 0, y: 0 }, 'mouse');
		const firstEnd = session.end(); // pending — decode 1 not yet resolved

		const secondEffects = await session.start(blob, { x: 4, y: 4 }, 'mouse');

		// Decode 1 (RED) now resolves — must be discarded.
		slow.resolve(decodedImageBy(9, 9, () => RED));
		const firstEffects = await first;

		// Click 2 is active with BLUE; click 1's late resolution did not commit
		// or clobber it.
		expect(session.isActive).toBe(true);
		expect(session.grid[CENTER_INDEX]).toEqual(BLUE);
		expect(firstEnd).toEqual([]);
		expect(firstEffects).toEqual([]);
		expect(secondEffects).toEqual([
			{ type: 'colorPick', target: 'foreground', color: BLUE }
		]);
	});

	it('cancel deactivates the session and clears any pending-commit', async () => {
		const SAMPLED: Color = { r: 12, g: 34, b: 56, a: 255 };
		const { deps, enqueueDeferred, enqueueResolved } = withQueuedDecodes();
		const decode = enqueueDeferred();
		enqueueResolved(decodedImageBy(9, 9, () => SAMPLED));
		const session = createReferenceSamplingSession(deps);

		// Trigger end-pending, then cancel — the late decode must NOT commit.
		const startPromise = session.start(blob, { x: 0, y: 0 }, 'mouse');
		session.end(); // sets endPending
		session.cancel();
		decode.resolve(decodedImageBy(9, 9, () => SAMPLED));
		const startEffects = await startPromise;

		expect(session.isActive).toBe(false);
		expect(startEffects).toEqual([]);
	});

	it('a new start while the previous session is still active discards the previous without auto-committing', async () => {
		const BLUE: Color = { r: 0, g: 0, b: 255, a: 255 };
		const { deps, enqueueResolved } = withQueuedDecodes();
		enqueueResolved(decodedImageBy(9, 9, () => RED));
		enqueueResolved(decodedImageBy(9, 9, () => BLUE));
		const session = createReferenceSamplingSession(deps);

		await session.start(blob, { x: 4, y: 4 }, 'mouse');
		expect(session.grid[CENTER_INDEX]).toEqual(RED);

		const secondEffects = await session.start(blob, { x: 4, y: 4 }, 'mouse');

		// Session is active with the new (BLUE) sample; first session was
		// discarded with only a preview effect (no addRecentColor entry).
		expect(session.isActive).toBe(true);
		expect(session.grid[CENTER_INDEX]).toEqual(BLUE);
		expect(secondEffects).toEqual([
			{ type: 'colorPick', target: 'foreground', color: BLUE }
		]);
	});

	it('a new start while a previous session is active cancels it immediately, before the new decode resolves', async () => {
		// Session 1 fully resolves and is active. Session 2's decode is slow,
		// leaving an async gap. During that gap, move() and end() must NOT see
		// the previous session as active and must NOT commit its grid.
		const { deps, enqueueResolved, enqueueDeferred } = withQueuedDecodes();
		enqueueResolved(decodedImageBy(9, 9, () => RED));
		const decode2 = enqueueDeferred();
		const session = createReferenceSamplingSession(deps);

		await session.start(blob, { x: 4, y: 4 }, 'mouse');
		expect(session.isActive).toBe(true);

		const startPromise = session.start(blob, { x: 4, y: 4 }, 'mouse');

		expect(session.isActive).toBe(false);
		expect(session.move({ x: 5, y: 5 })).toEqual([]);

		decode2.resolve(decodedImageBy(9, 9, () => RED));
		await startPromise;
	});

	it('inputSource is plumbed through to the loupe positioning', async () => {
		// Touch and mouse inputs use different loupe offsets — verifying via
		// session.position that the right offset is selected confirms inputSource
		// reaches the inner sampling session.
		const { deps, enqueueResolved } = withQueuedDecodes();
		enqueueResolved(decodedImageBy(9, 9, () => RED));
		enqueueResolved(decodedImageBy(9, 9, () => RED));

		const mouseSession = createReferenceSamplingSession(deps);
		await mouseSession.start(blob, { x: 4, y: 4 }, 'mouse');
		mouseSession.updatePointer({
			screen: { x: 600, y: 400 },
			viewport: { width: 1200, height: 800 }
		});
		const mousePos = mouseSession.position;

		const touchSession = createReferenceSamplingSession(deps);
		await touchSession.start(blob, { x: 4, y: 4 }, 'touch');
		touchSession.updatePointer({
			screen: { x: 600, y: 400 },
			viewport: { width: 1200, height: 800 }
		});
		const touchPos = touchSession.position;

		expect(mousePos).not.toEqual(touchPos);
	});

	it('release before decode + decode failure stays silent', async () => {
		const { deps, enqueueDeferred } = withQueuedDecodes();
		const decode = enqueueDeferred();
		const session = createReferenceSamplingSession(deps);

		const startPromise = session.start(blob, { x: 4, y: 4 }, 'mouse');
		const endEffects = session.end();
		decode.reject(new Error('decode failed'));
		const startEffects = await startPromise;

		expect(session.isActive).toBe(false);
		expect(endEffects).toEqual([]);
		expect(startEffects).toEqual([]);
	});
});
