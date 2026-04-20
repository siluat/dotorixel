import { describe, expect, it, vi } from 'vitest';
import { shapeTool, type SessionHost } from './tool-authoring';
import { BLACK, WHITE, createFakeDrawingOps, createFakePixelCanvas } from './fake-drawing-ops';
import type { CanvasCoords, PixelCanvas } from './canvas-model';
import type { Color } from './color';
import type { SamplingSession } from './sampling-session.svelte';
import type { ToolContext } from './draw-tool';

function makeHost(
	canvas: PixelCanvas,
	isShiftHeld: () => boolean = () => false
): { host: SessionHost; pushSnapshot: ReturnType<typeof vi.fn> } {
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
			isShiftHeld,
			pixelPerfect: false
		}
	};
}

const RED: Color = { r: 255, g: 0, b: 0, a: 255 };

describe('shapeTool sugar', () => {
	it('attaches the id passed in the spec', () => {
		const tool = shapeTool({
			id: 'line',
			stroke: vi.fn(),
			constrainOnShift: (_s, e) => e
		});
		expect(tool.id).toBe('line');
	});

	it('pushes history on start and emits addRecentColor by default', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host, pushSnapshot } = makeHost(canvas);
		const tool = shapeTool({
			id: 'line',
			stroke: vi.fn(),
			constrainOnShift: (_s, e) => e
		});
		const session = tool.open(host, { drawColor: RED, drawButton: 0, inputSource: 'mouse' });

		const effects = session.start();

		expect(pushSnapshot).toHaveBeenCalledOnce();
		expect(effects).toEqual([{ type: 'addRecentColor', hex: '#ff0000' }]);
	});

	it('opts out of addRecentColor when addsActiveColor is false', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const tool = shapeTool({
			id: 'line',
			stroke: vi.fn(),
			constrainOnShift: (_s, e) => e,
			addsActiveColor: false
		});
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });

		expect(session.start()).toEqual([]);
	});

	it('calls stroke(ctx, start, start) on the first draw (degenerate anchor)', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const stroke = vi.fn();
		const tool = shapeTool({
			id: 'line',
			stroke,
			constrainOnShift: (_s, e) => e
		});
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });
		session.start();

		const effects = session.draw({ x: 2, y: 3 }, null);

		expect(stroke).toHaveBeenCalledOnce();
		const [ctx, start, end] = stroke.mock.calls[0] as [ToolContext, CanvasCoords, CanvasCoords];
		expect(ctx.canvas).toBe(canvas);
		expect(start).toEqual({ x: 2, y: 3 });
		expect(end).toEqual({ x: 2, y: 3 });
		expect(effects).toEqual([{ type: 'canvasChanged' }]);
	});

	it('restores snapshot and calls stroke(ctx, anchor, end) on subsequent draws', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const stroke = vi.fn();
		const tool = shapeTool({
			id: 'line',
			stroke,
			constrainOnShift: (_s, e) => e
		});
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });
		session.start();
		session.draw({ x: 1, y: 1 }, null);

		const restoreCountBefore = canvas.restoreCalls.length;
		const effects = session.draw({ x: 5, y: 3 }, { x: 1, y: 1 });

		expect(canvas.restoreCalls.length).toBe(restoreCountBefore + 1);
		expect(stroke).toHaveBeenCalledTimes(2);
		const [, anchor, end] = stroke.mock.calls[1] as [ToolContext, CanvasCoords, CanvasCoords];
		expect(anchor).toEqual({ x: 1, y: 1 });
		expect(end).toEqual({ x: 5, y: 3 });
		expect(effects).toEqual([{ type: 'canvasChanged' }]);
	});

	it('applies constrainOnShift when isShiftHeld returns true', () => {
		const canvas = createFakePixelCanvas(8, 8);
		let shift = true;
		const { host } = makeHost(canvas, () => shift);
		const stroke = vi.fn();
		const constrainOnShift = vi.fn((_s: CanvasCoords, _e: CanvasCoords) => ({ x: 99, y: 99 }));
		const tool = shapeTool({ id: 'line', stroke, constrainOnShift });
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });
		session.start();
		session.draw({ x: 1, y: 1 }, null);
		session.draw({ x: 5, y: 3 }, { x: 1, y: 1 });

		expect(constrainOnShift).toHaveBeenCalledOnce();
		const [, , end] = stroke.mock.calls[1] as [ToolContext, CanvasCoords, CanvasCoords];
		expect(end).toEqual({ x: 99, y: 99 });

		// Release shift and call modifierChanged — constrain should no longer apply.
		shift = false;
		session.modifierChanged();
		expect(constrainOnShift).toHaveBeenCalledOnce();
		const [, , end2] = stroke.mock.calls[2] as [ToolContext, CanvasCoords, CanvasCoords];
		expect(end2).toEqual({ x: 5, y: 3 });
	});

	it('modifierChanged is a no-op before the first draw', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const stroke = vi.fn();
		const tool = shapeTool({ id: 'line', stroke, constrainOnShift: (_s, e) => e });
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });
		session.start();

		expect(session.modifierChanged()).toEqual([]);
		expect(stroke).not.toHaveBeenCalled();
	});

	it('end returns no effects', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { host } = makeHost(canvas);
		const tool = shapeTool({
			id: 'line',
			stroke: vi.fn(),
			constrainOnShift: (_s, e) => e
		});
		const session = tool.open(host, { drawColor: BLACK, drawButton: 0, inputSource: 'mouse' });
		session.start();

		expect(session.end()).toEqual([]);
	});
});
