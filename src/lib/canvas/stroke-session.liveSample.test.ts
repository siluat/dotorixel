import { describe, expect, it } from 'vitest';
import { createStrokeSessions, type StrokeDeps } from './stroke-session';
import { createFakeDrawingOps, WHITE } from './fake-drawing-ops';
import type { CanvasCoords, PixelCanvas } from './canvas-model';
import type { Color } from './color';
import type {
	SamplingSession,
	SamplingSessionStartParams
} from './sampling-session.svelte';
import type { ToolEffects } from './draw-tool';

const RED: Color = { r: 255, g: 0, b: 0, a: 255 };

interface FakeSamplingCall {
	readonly method: 'start' | 'update' | 'commit' | 'cancel';
	readonly payload?: SamplingSessionStartParams | CanvasCoords;
}

function createFakeSamplingSession(commitResult: ToolEffects = []): {
	readonly session: SamplingSession;
	readonly calls: ReadonlyArray<FakeSamplingCall>;
} {
	const calls: FakeSamplingCall[] = [];
	const session: SamplingSession = {
		isActive: false,
		grid: [],
		centerColor: null,
		inputSource: null,
		start(params) {
			calls.push({ method: 'start', payload: params });
		},
		update(targetPixel) {
			calls.push({ method: 'update', payload: targetPixel });
		},
		commit() {
			calls.push({ method: 'commit' });
			return commitResult;
		},
		cancel() {
			calls.push({ method: 'cancel' });
		}
	};
	return { session, calls };
}

function makeDeps(session: SamplingSession): StrokeDeps {
	return {
		host: {
			pixelCanvas: {} as PixelCanvas,
			foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
			backgroundColor: WHITE
		},
		baseOps: createFakeDrawingOps(8, 8, WHITE),
		history: { pushSnapshot: () => {} },
		sampling: session,
		isShiftHeld: () => false,
		pixelPerfect: () => false
	};
}

describe('sessions.liveSample', () => {
	it('fires no entry-time effects on start', () => {
		const { session } = createFakeSamplingSession();
		const sessions = createStrokeSessions(makeDeps(session));
		const s = sessions.liveSample({ drawButton: 0, inputSource: 'mouse' });
		expect(s.start()).toEqual([]);
	});

	it('starts sampling on the first draw with commitTarget=foreground for left-click', () => {
		const { session, calls } = createFakeSamplingSession();
		const sessions = createStrokeSessions(makeDeps(session));
		const s = sessions.liveSample({ drawButton: 0, inputSource: 'mouse' });
		s.start();

		s.draw({ x: 3, y: 4 }, null);

		expect(calls).toEqual([
			{
				method: 'start',
				payload: {
					targetPixel: { x: 3, y: 4 },
					commitTarget: 'foreground',
					inputSource: 'mouse'
				}
			}
		]);
	});

	it('uses commitTarget=background for right-click', () => {
		const { session, calls } = createFakeSamplingSession();
		const sessions = createStrokeSessions(makeDeps(session));
		const s = sessions.liveSample({ drawButton: 2, inputSource: 'touch' });

		s.start();
		s.draw({ x: 1, y: 1 }, null);

		expect(calls[0]).toEqual({
			method: 'start',
			payload: {
				targetPixel: { x: 1, y: 1 },
				commitTarget: 'background',
				inputSource: 'touch'
			}
		});
	});

	it('updates sampling on subsequent draws', () => {
		const { session, calls } = createFakeSamplingSession();
		const sessions = createStrokeSessions(makeDeps(session));
		const s = sessions.liveSample({ drawButton: 0, inputSource: 'mouse' });
		s.start();

		s.draw({ x: 1, y: 1 }, null);
		s.draw({ x: 2, y: 2 }, { x: 1, y: 1 });
		s.draw({ x: 3, y: 3 }, { x: 2, y: 2 });

		expect(calls).toEqual([
			{
				method: 'start',
				payload: {
					targetPixel: { x: 1, y: 1 },
					commitTarget: 'foreground',
					inputSource: 'mouse'
				}
			},
			{ method: 'update', payload: { x: 2, y: 2 } },
			{ method: 'update', payload: { x: 3, y: 3 } }
		]);
	});

	it('returns sampling.commit() effects from end()', () => {
		const commitEffects: ToolEffects = [
			{ type: 'colorPick', target: 'foreground', color: RED },
			{ type: 'addRecentColor', hex: '#ff0000' }
		];
		const { session } = createFakeSamplingSession(commitEffects);
		const sessions = createStrokeSessions(makeDeps(session));
		const s = sessions.liveSample({ drawButton: 0, inputSource: 'mouse' });
		s.start();
		s.draw({ x: 1, y: 1 }, null);

		expect(s.end()).toEqual(commitEffects);
	});

	it('returns no effects on modifierChanged', () => {
		const { session } = createFakeSamplingSession();
		const sessions = createStrokeSessions(makeDeps(session));
		const s = sessions.liveSample({ drawButton: 0, inputSource: 'mouse' });
		s.start();
		expect(s.modifierChanged()).toEqual([]);
	});
});
