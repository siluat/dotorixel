import { describe, expect, it, vi } from 'vitest';
import { createStrokeSessions, type StrokeDeps } from './stroke-session';
import { BLACK, WHITE, createFakeDrawingOps, createFakePixelCanvas } from './fake-drawing-ops';
import type { CanvasCoords, PixelCanvas } from './canvas-model';
import type { ShapePreviewTool, ToolContext } from './draw-tool';
import type { SamplingSession } from './sampling-session.svelte';

function makeDeps(canvas: PixelCanvas, isShiftHeld: () => boolean = () => false): {
	deps: StrokeDeps;
	pushSnapshot: ReturnType<typeof vi.fn>;
} {
	const pushSnapshot = vi.fn();
	return {
		pushSnapshot,
		deps: {
			host: {
				pixelCanvas: canvas,
				foregroundColor: BLACK,
				backgroundColor: WHITE
			},
			baseOps: createFakeDrawingOps(8, 8, WHITE),
			history: { pushSnapshot },
			sampling: {} as SamplingSession,
			isShiftHeld,
			pixelPerfect: () => false
		}
	};
}

function makeTool(overrides: Partial<ShapePreviewTool> = {}): ShapePreviewTool {
	return {
		kind: 'shapePreview',
		addsActiveColor: true,
		constrainFn: (_start, end) => end,
		onAnchor: vi.fn(),
		onPreview: vi.fn(),
		...overrides
	};
}

describe('sessions.shapePreview', () => {
	it('pushes history and fires addRecentColor on start when addsActiveColor is true', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps, pushSnapshot } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const tool = makeTool({ addsActiveColor: true });
		const s = sessions.shapePreview({
			tool,
			drawColor: { r: 255, g: 0, b: 0, a: 255 },
			drawButton: 0
		});

		const effects = s.start();

		expect(pushSnapshot).toHaveBeenCalledOnce();
		expect(effects).toEqual([{ type: 'addRecentColor', hex: '#ff0000' }]);
	});

	it('returns no entry effects when addsActiveColor is false', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const tool = makeTool({ addsActiveColor: false });
		const s = sessions.shapePreview({ tool, drawColor: BLACK, drawButton: 0 });

		expect(s.start()).toEqual([]);
	});

	it('stamps the anchor on the first draw via onAnchor', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const onAnchor = vi.fn();
		const tool = makeTool({ onAnchor });
		const s = sessions.shapePreview({ tool, drawColor: BLACK, drawButton: 0 });
		s.start();

		const effects = s.draw({ x: 2, y: 3 }, null);

		expect(onAnchor).toHaveBeenCalledOnce();
		const [ctx, anchor] = onAnchor.mock.calls[0] as [ToolContext, CanvasCoords];
		expect(ctx.canvas).toBe(canvas);
		expect(anchor).toEqual({ x: 2, y: 3 });
		expect(effects).toEqual([{ type: 'canvasChanged' }]);
	});

	it('restores snapshot and calls onPreview with unconstrained end on subsequent draws', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const onPreview = vi.fn();
		const constrainFn = vi.fn((_s: CanvasCoords, e: CanvasCoords) => e);
		const tool = makeTool({ onPreview, constrainFn });
		const s = sessions.shapePreview({ tool, drawColor: BLACK, drawButton: 0 });
		s.start();
		s.draw({ x: 1, y: 1 }, null);

		const restoreCountBefore = canvas.restoreCalls.length;
		const effects = s.draw({ x: 5, y: 3 }, { x: 1, y: 1 });

		expect(canvas.restoreCalls.length).toBe(restoreCountBefore + 1);
		expect(constrainFn).not.toHaveBeenCalled();
		expect(onPreview).toHaveBeenCalledOnce();
		const [, anchor, end] = onPreview.mock.calls[0] as [
			ToolContext,
			CanvasCoords,
			CanvasCoords
		];
		expect(anchor).toEqual({ x: 1, y: 1 });
		expect(end).toEqual({ x: 5, y: 3 });
		expect(effects).toEqual([{ type: 'canvasChanged' }]);
	});

	it('applies constrainFn when shift is held', () => {
		const canvas = createFakePixelCanvas(8, 8);
		let shift = true;
		const { deps } = makeDeps(canvas, () => shift);
		const sessions = createStrokeSessions(deps);
		const onPreview = vi.fn();
		const constrainFn = vi.fn((_s: CanvasCoords, _e: CanvasCoords) => ({ x: 99, y: 99 }));
		const tool = makeTool({ onPreview, constrainFn });
		const s = sessions.shapePreview({ tool, drawColor: BLACK, drawButton: 0 });
		s.start();
		s.draw({ x: 1, y: 1 }, null);
		s.draw({ x: 5, y: 3 }, { x: 1, y: 1 });

		expect(constrainFn).toHaveBeenCalledOnce();
		const [, , end] = onPreview.mock.calls[0] as [ToolContext, CanvasCoords, CanvasCoords];
		expect(end).toEqual({ x: 99, y: 99 });

		// Flip shift off and re-modifier; constrainFn should no longer run.
		shift = false;
		s.modifierChanged();
		expect(constrainFn).toHaveBeenCalledOnce();
		const [, , end2] = onPreview.mock.calls[1] as [ToolContext, CanvasCoords, CanvasCoords];
		expect(end2).toEqual({ x: 5, y: 3 });
	});

	it('modifierChanged is a no-op before the first draw', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const onPreview = vi.fn();
		const tool = makeTool({ onPreview });
		const s = sessions.shapePreview({ tool, drawColor: BLACK, drawButton: 0 });
		s.start();

		expect(s.modifierChanged()).toEqual([]);
		expect(onPreview).not.toHaveBeenCalled();
	});

	it('end returns no effects', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const s = sessions.shapePreview({ tool: makeTool(), drawColor: BLACK, drawButton: 0 });
		s.start();
		expect(s.end()).toEqual([]);
	});
});
