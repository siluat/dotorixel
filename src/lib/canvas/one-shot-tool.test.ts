import { describe, expect, it, vi } from 'vitest';
import { oneShotTool, type SessionHost } from './tool-authoring';
import { BLACK, WHITE, createFakeDrawingOps, createFakePixelCanvas } from './fake-drawing-ops';
import type { CanvasCoords, PixelCanvas } from './canvas-model';
import type { Color } from './color';
import type { SamplingSession } from './sampling-session.svelte';
import type { ToolContext } from './draw-tool';

function makeHost(canvas: PixelCanvas): {
	host: SessionHost;
	pushSnapshot: ReturnType<typeof vi.fn>;
} {
	const pushSnapshot = vi.fn();
	return {
		pushSnapshot,
		host: {
			pixelCanvas: canvas,
			foregroundColor: BLACK,
			backgroundColor: WHITE,
			baseOps: createFakeDrawingOps(8, 8, WHITE),
			history: { pushSnapshot },
			sampling: {} as SamplingSession,
			isShiftHeld: () => false,
			pixelPerfect: false
		}
	};
}

const RED: Color = { r: 255, g: 0, b: 0, a: 255 };

describe('oneShotTool sugar', () => {
	it('attaches the id passed in the spec', () => {
		const tool = oneShotTool({ id: 'floodfill', execute: vi.fn(() => []) });
		expect(tool.id).toBe('floodfill');
	});

	it('pushes history on start by default', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host, pushSnapshot } = makeHost(canvas);
		const tool = oneShotTool({ id: 'floodfill', execute: vi.fn(() => []) });
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });

		session.start();

		expect(pushSnapshot).toHaveBeenCalledOnce();
	});

	it('opts out of history when capturesHistory is false', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host, pushSnapshot } = makeHost(canvas);
		const tool = oneShotTool({
			id: 'floodfill',
			execute: vi.fn(() => []),
			capturesHistory: false
		});
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });

		session.start();

		expect(pushSnapshot).not.toHaveBeenCalled();
	});

	it('emits addRecentColor on start by default', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const tool = oneShotTool({ id: 'floodfill', execute: vi.fn(() => []) });
		const session = tool.open(host, { drawColor: RED, drawButton: 0, inputSource: 'mouse' });

		expect(session.start()).toEqual([{ type: 'addRecentColor', hex: '#ff0000' }]);
	});

	it('opts out of addRecentColor when addsActiveColor is false', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const tool = oneShotTool({
			id: 'floodfill',
			execute: vi.fn(() => []),
			addsActiveColor: false
		});
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });

		expect(session.start()).toEqual([]);
	});

	it('fires execute once on first draw and returns its effects', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const captured: { ctx?: ToolContext; target?: CanvasCoords } = {};
		const tool = oneShotTool({
			id: 'floodfill',
			execute(ctx, target) {
				captured.ctx = ctx;
				captured.target = target;
				return [{ type: 'canvasChanged' }];
			}
		});
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });
		session.start();

		const effects = session.draw({ x: 3, y: 4 }, null);

		expect(effects).toEqual([{ type: 'canvasChanged' }]);
		expect(captured.target).toEqual({ x: 3, y: 4 });
		expect(captured.ctx?.canvas).toBe(canvas);
		expect(captured.ctx?.drawColor).toEqual(BLACK);
	});

	it('ignores subsequent draws after the first fire', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const execute = vi.fn(() => [{ type: 'canvasChanged' as const }]);
		const tool = oneShotTool({ id: 'floodfill', execute });
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });
		session.start();

		session.draw({ x: 1, y: 1 }, null);
		const second = session.draw({ x: 2, y: 2 }, { x: 1, y: 1 });
		const third = session.draw({ x: 3, y: 3 }, { x: 2, y: 2 });

		expect(execute).toHaveBeenCalledOnce();
		expect(second).toEqual([]);
		expect(third).toEqual([]);
	});

	it('returns no effects on modifierChanged and end', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const tool = oneShotTool({ id: 'floodfill', execute: vi.fn(() => []) });
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });
		session.start();
		session.draw({ x: 1, y: 1 }, null);

		expect(session.modifierChanged()).toEqual([]);
		expect(session.end()).toEqual([]);
	});
});
