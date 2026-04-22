import { describe, expect, it, vi } from 'vitest';
import { customTool, type SessionHost, type StrokeSession, type StrokeSpec } from './tool-authoring';
import { BLACK, WHITE, createFakeDrawingOps, createFakePixelCanvas } from './fake-drawing-ops';
import type { PixelCanvas } from './canvas-model';
import type { SamplingSession } from './sampling-session.svelte';

function makeHost(canvas: PixelCanvas): SessionHost {
	return {
		pixelCanvas: canvas,
		foregroundColor: BLACK,
		backgroundColor: WHITE,
		baseOps: createFakeDrawingOps(8, 8, WHITE),
		history: { pushSnapshot: vi.fn() },
		sampling: {} as SamplingSession,
		isShiftHeld: () => false,
		pixelPerfect: false
	};
}

function makeSpec(overrides?: Partial<StrokeSpec>): StrokeSpec {
	return {
		drawColor: BLACK,
		drawButton: 0,
		inputSource: 'mouse',
		...overrides
	};
}

describe('customTool sugar', () => {
	it('attaches the id passed in the spec', () => {
		const tool = customTool({
			id: 'eyedropper',
			open: () => ({
				start: () => [],
				draw: () => [],
				modifierChanged: () => [],
				end: () => []
			})
		});

		expect(tool.id).toBe('eyedropper');
	});

	it('invokes the author-provided open with (host, spec) on each begin', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const host = makeHost(canvas);
		const spec = makeSpec({ drawButton: 2, inputSource: 'touch' });
		const open = vi.fn((_host: SessionHost, _spec: StrokeSpec) => ({
			start: () => [],
			draw: () => [],
			modifierChanged: () => [],
			end: () => []
		}));
		const tool = customTool({
			id: 'eyedropper',
			open
		});

		tool.open(host, spec);

		expect(open).toHaveBeenCalledOnce();
		expect(open.mock.calls[0][0]).toBe(host);
		expect(open.mock.calls[0][1]).toBe(spec);
	});

	it('returned session lifecycle methods pass through unchanged', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const host = makeHost(canvas);
		const calls: string[] = [];
		const authorSession: StrokeSession = {
			start() {
				calls.push('start');
				return [{ type: 'addRecentColor', hex: '#abcdef' }];
			},
			draw(current, previous) {
				calls.push(`draw(${current.x},${current.y} prev=${previous ? 'yes' : 'null'})`);
				return [{ type: 'canvasChanged' }];
			},
			modifierChanged() {
				calls.push('modifierChanged');
				return [];
			},
			end() {
				calls.push('end');
				return [{ type: 'colorPick', target: 'foreground', color: BLACK }];
			}
		};
		const tool = customTool({
			id: 'move',
			open: () => authorSession
		});
		const session = tool.open(host, makeSpec());

		expect(session.start()).toEqual([{ type: 'addRecentColor', hex: '#abcdef' }]);
		expect(session.draw({ x: 2, y: 3 }, null)).toEqual([{ type: 'canvasChanged' }]);
		expect(session.modifierChanged()).toEqual([]);
		expect(session.end()).toEqual([{ type: 'colorPick', target: 'foreground', color: BLACK }]);
		expect(calls).toEqual([
			'start',
			'draw(2,3 prev=null)',
			'modifierChanged',
			'end'
		]);
	});
});
