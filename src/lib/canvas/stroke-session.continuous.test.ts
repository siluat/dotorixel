import { describe, expect, it, vi } from 'vitest';
import { createStrokeSessions, type StrokeDeps } from './stroke-session';
import {
	BLACK,
	WHITE,
	createFakeDrawingOps,
	createFakePixelCanvas,
	type FakeDrawingOps
} from './fake-drawing-ops';
import type { CanvasCoords, PixelCanvas } from './canvas-model';
import type { ContinuousTool, ToolContext } from './draw-tool';
import type { SamplingSession } from './sampling-session.svelte';

function makeDeps(
	canvas: PixelCanvas,
	opts: { pixelPerfect?: boolean; baseOps?: FakeDrawingOps } = {}
): {
	deps: StrokeDeps;
	pushSnapshot: ReturnType<typeof vi.fn>;
	baseOps: FakeDrawingOps;
} {
	const pushSnapshot = vi.fn();
	const baseOps = opts.baseOps ?? createFakeDrawingOps(8, 8, WHITE);
	return {
		pushSnapshot,
		baseOps,
		deps: {
			host: {
				pixelCanvas: canvas,
				foregroundColor: BLACK,
				backgroundColor: WHITE
			},
			baseOps,
			history: { pushSnapshot },
			sampling: {} as SamplingSession,
			isShiftHeld: () => false,
			pixelPerfect: () => opts.pixelPerfect ?? false
		}
	};
}

function makeTool(overrides: Partial<ContinuousTool> = {}): ContinuousTool {
	return {
		kind: 'continuous',
		supportsPixelPerfect: false,
		addsActiveColor: true,
		apply: vi.fn(() => true),
		...overrides
	};
}

describe('sessions.continuous', () => {
	it('pushes history and emits addRecentColor on start when addsActiveColor is true', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps, pushSnapshot } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const tool = makeTool({ addsActiveColor: true });
		const s = sessions.continuous({
			tool,
			drawColor: { r: 255, g: 0, b: 0, a: 255 },
			drawButton: 0
		});

		const effects = s.start();

		expect(pushSnapshot).toHaveBeenCalledOnce();
		expect(effects).toEqual([{ type: 'addRecentColor', hex: '#ff0000' }]);
	});

	it('pushes history but emits no entry effects when addsActiveColor is false', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps, pushSnapshot } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const tool = makeTool({ addsActiveColor: false });
		const s = sessions.continuous({ tool, drawColor: BLACK, drawButton: 0 });

		const effects = s.start();

		expect(pushSnapshot).toHaveBeenCalledOnce();
		expect(effects).toEqual([]);
	});

	it('returns CANVAS_CHANGED and passes ctx + current + previous when apply returns true', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const captured: {
			ctx?: ToolContext;
			current?: CanvasCoords;
			previous?: CanvasCoords | null;
		} = {};
		const tool = makeTool({
			apply(ctx, current, previous) {
				captured.ctx = ctx;
				captured.current = current;
				captured.previous = previous;
				return true;
			}
		});
		const s = sessions.continuous({ tool, drawColor: BLACK, drawButton: 0 });
		s.start();

		const firstEffects = s.draw({ x: 1, y: 1 }, null);
		const secondEffects = s.draw({ x: 2, y: 2 }, { x: 1, y: 1 });

		expect(firstEffects).toEqual([{ type: 'canvasChanged' }]);
		expect(secondEffects).toEqual([{ type: 'canvasChanged' }]);
		expect(captured.current).toEqual({ x: 2, y: 2 });
		expect(captured.previous).toEqual({ x: 1, y: 1 });
		expect(captured.ctx?.canvas).toBe(canvas);
		expect(captured.ctx?.drawColor).toEqual(BLACK);
		expect(captured.ctx?.drawButton).toBe(0);
	});

	it('returns NO_EFFECTS when apply returns false', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const tool = makeTool({ apply: vi.fn(() => false) });
		const s = sessions.continuous({ tool, drawColor: BLACK, drawButton: 0 });
		s.start();

		expect(s.draw({ x: 1, y: 1 }, null)).toEqual([]);
	});

	it('passes the bare baseOps to apply when pixel-perfect is disabled', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps, baseOps } = makeDeps(canvas, { pixelPerfect: false });
		const sessions = createStrokeSessions(deps);
		let seenOps: unknown = null;
		const tool = makeTool({
			supportsPixelPerfect: true,
			apply(ctx) {
				seenOps = ctx.ops;
				return true;
			}
		});
		const s = sessions.continuous({ tool, drawColor: BLACK, drawButton: 0 });
		s.start();
		s.draw({ x: 0, y: 0 }, null);

		expect(seenOps).toBe(baseOps);
	});

	it('passes the bare baseOps to apply when the tool does not support pixel-perfect', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps, baseOps } = makeDeps(canvas, { pixelPerfect: true });
		const sessions = createStrokeSessions(deps);
		let seenOps: unknown = null;
		const tool = makeTool({
			supportsPixelPerfect: false,
			apply(ctx) {
				seenOps = ctx.ops;
				return true;
			}
		});
		const s = sessions.continuous({ tool, drawColor: BLACK, drawButton: 0 });
		s.start();
		s.draw({ x: 0, y: 0 }, null);

		expect(seenOps).toBe(baseOps);
	});

	it('returns no effects on modifierChanged and end', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const s = sessions.continuous({ tool: makeTool(), drawColor: BLACK, drawButton: 0 });
		s.start();
		s.draw({ x: 1, y: 1 }, null);

		expect(s.modifierChanged()).toEqual([]);
		expect(s.end()).toEqual([]);
	});
});
