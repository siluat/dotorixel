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

// Pencil stand-in for stroke-level PP assertions: emits [curr] on the first
// sample and [prev, curr] on subsequent ones, matching the Bresenham-style
// shared-junction batching the real pencil produces for adjacent pointer moves.
function makePencilTool(): ContinuousTool {
	return {
		kind: 'continuous',
		addsActiveColor: true,
		supportsPixelPerfect: true,
		apply(ctx, current, previous) {
			const segment = previous
				? new Int32Array([previous.x, previous.y, current.x, current.y])
				: new Int32Array([current.x, current.y]);
			return ctx.ops.applyStroke(segment, 'pencil', ctx.drawColor);
		}
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

	// L-corner regression defense: an adjacent 3-sample pencil stroke
	// (0,0) → (1,0) → (1,1) forms an L. Under pixel-perfect, the middle
	// pixel (1,0) must revert to its pre-stroke color; without PP, all
	// three pixels stay painted.
	it('reverts the L-corner middle pixel when pixel-perfect is enabled', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps, baseOps } = makeDeps(canvas, { pixelPerfect: true });
		const sessions = createStrokeSessions(deps);
		const s = sessions.continuous({
			tool: makePencilTool(),
			drawColor: BLACK,
			drawButton: 0
		});
		s.start();

		s.draw({ x: 0, y: 0 }, null);
		s.draw({ x: 1, y: 0 }, { x: 0, y: 0 });
		s.draw({ x: 1, y: 1 }, { x: 1, y: 0 });

		expect(baseOps.getPixel(0, 0)).toEqual(BLACK);
		expect(baseOps.getPixel(1, 0)).toEqual(WHITE);
		expect(baseOps.getPixel(1, 1)).toEqual(BLACK);
	});

	it('paints every pixel of an L-corner stroke when pixel-perfect is disabled', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps, baseOps } = makeDeps(canvas, { pixelPerfect: false });
		const sessions = createStrokeSessions(deps);
		const s = sessions.continuous({
			tool: makePencilTool(),
			drawColor: BLACK,
			drawButton: 0
		});
		s.start();

		s.draw({ x: 0, y: 0 }, null);
		s.draw({ x: 1, y: 0 }, { x: 0, y: 0 });
		s.draw({ x: 1, y: 1 }, { x: 1, y: 0 });

		expect(baseOps.getPixel(0, 0)).toEqual(BLACK);
		expect(baseOps.getPixel(1, 0)).toEqual(BLACK);
		expect(baseOps.getPixel(1, 1)).toEqual(BLACK);
	});

	// First-touch cache regression defense: when a coord is painted,
	// revisited within the same stroke, and later reverted as an L-corner
	// middle pixel, the revert must restore the original pre-stroke color
	// (WHITE), not the mid-stroke color (BLACK).
	it('preserves the first pre-paint color when a coord is revisited within a PP stroke', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps, baseOps } = makeDeps(canvas, { pixelPerfect: true });
		const sessions = createStrokeSessions(deps);
		const s = sessions.continuous({
			tool: makePencilTool(),
			drawColor: BLACK,
			drawButton: 0
		});
		s.start();

		// Paint (1,0) WHITE→BLACK, step to (0,0), revisit (1,0) (no cache
		// update — first-touch wins), then step to (1,1) to close the L.
		s.draw({ x: 1, y: 0 }, null);
		s.draw({ x: 0, y: 0 }, { x: 1, y: 0 });
		s.draw({ x: 1, y: 0 }, { x: 0, y: 0 });
		s.draw({ x: 1, y: 1 }, { x: 1, y: 0 });

		expect(baseOps.getPixel(1, 0)).toEqual(WHITE);
	});
});
