import { describe, expect, it, vi } from 'vitest';
import { continuousTool, type ApplyFn, type SessionHost } from './tool-authoring';
import {
	BLACK,
	WHITE,
	createFakeDrawingOps,
	createFakePixelCanvas,
	type FakeDrawingOps
} from './fake-drawing-ops';
import type { PixelCanvas, CanvasCoords } from './canvas-model';
import type { Color } from './color';
import type { SamplingSession } from './sampling-session.svelte';
import type { ToolContext } from './draw-tool';

function makeHost(
	canvas: PixelCanvas,
	opts: { pixelPerfect?: boolean; baseOps?: FakeDrawingOps } = {}
): { host: SessionHost; pushSnapshot: ReturnType<typeof vi.fn>; baseOps: FakeDrawingOps } {
	const pushSnapshot = vi.fn();
	const baseOps = opts.baseOps ?? createFakeDrawingOps(8, 8, WHITE);
	return {
		pushSnapshot,
		baseOps,
		host: {
			pixelCanvas: canvas,
			foregroundColor: BLACK,
			backgroundColor: WHITE,
			baseOps,
			history: { pushSnapshot },
			sampling: {} as SamplingSession,
			isShiftHeld: () => false,
			pixelPerfect: opts.pixelPerfect ?? false
		}
	};
}

const RED: Color = { r: 255, g: 0, b: 0, a: 255 };

describe('continuousTool sugar', () => {
	it('attaches the id passed in the spec', () => {
		const tool = continuousTool({ id: 'pencil', apply: vi.fn(() => true) });
		expect(tool.id).toBe('pencil');
	});

	it('pushes history on start', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host, pushSnapshot } = makeHost(canvas);
		const tool = continuousTool({ id: 'pencil', apply: vi.fn(() => true) });
		const session = tool.open(host, {
			drawColor: BLACK,
			drawButton: 0,
			inputSource: 'mouse'
		});

		session.start();

		expect(pushSnapshot).toHaveBeenCalledOnce();
	});

	it('emits addRecentColor on start by default', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const tool = continuousTool({ id: 'pencil', apply: vi.fn(() => true) });
		const session = tool.open(host, {
			drawColor: RED,
			drawButton: 0,
			inputSource: 'mouse'
		});

		expect(session.start()).toEqual([{ type: 'addRecentColor', hex: '#ff0000' }]);
	});

	it('opts out of addRecentColor when addsActiveColor is false', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const tool = continuousTool({
			id: 'eraser',
			apply: vi.fn(() => true),
			addsActiveColor: false
		});
		const session = tool.open(host, {
			drawColor: BLACK,
			drawButton: 0,
			inputSource: 'mouse'
		});

		expect(session.start()).toEqual([]);
	});

	it('returns CANVAS_CHANGED from draw when apply returns true', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const tool = continuousTool({ id: 'pencil', apply: () => true });
		const session = tool.open(host, {
			drawColor: BLACK,
			drawButton: 0,
			inputSource: 'mouse'
		});
		session.start();

		expect(session.draw({ x: 1, y: 1 }, null)).toEqual([{ type: 'canvasChanged' }]);
	});

	it('returns NO_EFFECTS from draw when apply returns false', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const tool = continuousTool({ id: 'pencil', apply: () => false });
		const session = tool.open(host, {
			drawColor: BLACK,
			drawButton: 0,
			inputSource: 'mouse'
		});
		session.start();

		expect(session.draw({ x: 1, y: 1 }, null)).toEqual([]);
	});

	it('passes ctx with drawColor, drawButton, and canvas to apply', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const captured: {
			ctx?: ToolContext;
			current?: CanvasCoords;
			previous?: CanvasCoords | null;
		} = {};
		const apply: ApplyFn = (ctx, current, previous) => {
			captured.ctx = ctx;
			captured.current = current;
			captured.previous = previous;
			return true;
		};
		const tool = continuousTool({ id: 'pencil', apply });
		const session = tool.open(host, { drawColor: RED, drawButton: 2, inputSource: 'mouse' });
		session.start();
		session.draw({ x: 2, y: 3 }, { x: 1, y: 1 });

		expect(captured.ctx?.canvas).toBe(canvas);
		expect(captured.ctx?.drawColor).toEqual(RED);
		expect(captured.ctx?.drawButton).toBe(2);
		expect(captured.current).toEqual({ x: 2, y: 3 });
		expect(captured.previous).toEqual({ x: 1, y: 1 });
	});

	it('passes the bare baseOps when pixelPerfect is disabled', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host, baseOps } = makeHost(canvas, { pixelPerfect: false });
		let seenOps: unknown = null;
		const tool = continuousTool({
			id: 'pencil',
			apply: (ctx) => {
				seenOps = ctx.ops;
				return true;
			}
		});
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });
		session.start();
		session.draw({ x: 0, y: 0 }, null);

		expect(seenOps).toBe(baseOps);
	});

	it('passes the bare baseOps when pixelPerfect is disabled on the tool', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host, baseOps } = makeHost(canvas, { pixelPerfect: true });
		let seenOps: unknown = null;
		const tool = continuousTool({
			id: 'pencil',
			apply: (ctx) => {
				seenOps = ctx.ops;
				return true;
			},
			pixelPerfect: false
		});
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });
		session.start();
		session.draw({ x: 0, y: 0 }, null);

		expect(seenOps).toBe(baseOps);
	});

	it('wraps baseOps with pixel-perfect filter when both flags are on (L-corner reverts)', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host, baseOps } = makeHost(canvas, { pixelPerfect: true });
		const tool = continuousTool({
			id: 'pencil',
			apply(ctx, current, previous) {
				const segment = previous
					? new Int32Array([previous.x, previous.y, current.x, current.y])
					: new Int32Array([current.x, current.y]);
				return ctx.ops.applyStroke(segment, 'pencil', ctx.drawColor);
			}
		});
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });
		session.start();

		session.draw({ x: 0, y: 0 }, null);
		session.draw({ x: 1, y: 0 }, { x: 0, y: 0 });
		session.draw({ x: 1, y: 1 }, { x: 1, y: 0 });

		// Middle of the L reverts to the pre-stroke color.
		expect(baseOps.getPixel(0, 0)).toEqual(BLACK);
		expect(baseOps.getPixel(1, 0)).toEqual(WHITE);
		expect(baseOps.getPixel(1, 1)).toEqual(BLACK);
	});

	it('returns no effects on modifierChanged and end', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const tool = continuousTool({ id: 'pencil', apply: () => true });
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });
		session.start();
		session.draw({ x: 0, y: 0 }, null);

		expect(session.modifierChanged()).toEqual([]);
		expect(session.end()).toEqual([]);
	});
});
