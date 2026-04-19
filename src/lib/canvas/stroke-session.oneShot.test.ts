import { describe, expect, it, vi } from 'vitest';
import { createStrokeSessions, type StrokeDeps } from './stroke-session';
import { BLACK, WHITE, createFakeDrawingOps, createFakePixelCanvas } from './fake-drawing-ops';
import type { CanvasCoords, PixelCanvas } from './canvas-model';
import type { OneShotTool, ToolContext } from './draw-tool';
import type { SamplingSession } from './sampling-session.svelte';

function makeDeps(canvas: PixelCanvas): {
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
			isShiftHeld: () => false,
			pixelPerfect: () => false
		}
	};
}

function makeTool(overrides: Partial<OneShotTool> = {}): OneShotTool {
	return {
		kind: 'oneShot',
		capturesHistory: true,
		addsActiveColor: false,
		execute: vi.fn(() => []),
		...overrides
	};
}

describe('sessions.oneShot', () => {
	it('pushes history on start when capturesHistory is true and emits addRecentColor when addsActiveColor is true', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps, pushSnapshot } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const tool = makeTool({ capturesHistory: true, addsActiveColor: true });
		const s = sessions.oneShot({
			tool,
			drawColor: { r: 255, g: 0, b: 0, a: 255 },
			drawButton: 0
		});

		const effects = s.start();

		expect(pushSnapshot).toHaveBeenCalledOnce();
		expect(effects).toEqual([{ type: 'addRecentColor', hex: '#ff0000' }]);
	});

	it('skips history and entry effects when both flags are false', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps, pushSnapshot } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const tool = makeTool({ capturesHistory: false, addsActiveColor: false });
		const s = sessions.oneShot({ tool, drawColor: BLACK, drawButton: 0 });

		const effects = s.start();

		expect(pushSnapshot).not.toHaveBeenCalled();
		expect(effects).toEqual([]);
	});

	it('fires execute once on first draw with context and target, returning its effects', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const captured: { ctx?: ToolContext; target?: CanvasCoords } = {};
		const tool = makeTool({
			addsActiveColor: false,
			execute(ctx, target) {
				captured.ctx = ctx;
				captured.target = target;
				return [{ type: 'canvasChanged' }];
			}
		});
		const s = sessions.oneShot({ tool, drawColor: BLACK, drawButton: 0 });
		s.start();

		const effects = s.draw({ x: 4, y: 5 }, null);

		expect(effects).toEqual([{ type: 'canvasChanged' }]);
		expect(captured.target).toEqual({ x: 4, y: 5 });
		expect(captured.ctx?.canvas).toBe(canvas);
		expect(captured.ctx?.drawColor).toEqual(BLACK);
		expect(captured.ctx?.drawButton).toBe(0);
	});

	it('ignores subsequent draws after the first fire', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const execute = vi.fn(() => [{ type: 'canvasChanged' as const }]);
		const tool = makeTool({ execute });
		const s = sessions.oneShot({ tool, drawColor: BLACK, drawButton: 0 });
		s.start();

		s.draw({ x: 1, y: 1 }, null);
		const secondEffects = s.draw({ x: 2, y: 2 }, { x: 1, y: 1 });
		const thirdEffects = s.draw({ x: 3, y: 3 }, { x: 2, y: 2 });

		expect(execute).toHaveBeenCalledOnce();
		expect(secondEffects).toEqual([]);
		expect(thirdEffects).toEqual([]);
	});

	it('returns no effects on modifierChanged and end', () => {
		const canvas = createFakePixelCanvas(8, 8);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const s = sessions.oneShot({ tool: makeTool(), drawColor: BLACK, drawButton: 0 });
		s.start();
		s.draw({ x: 1, y: 1 }, null);

		expect(s.modifierChanged()).toEqual([]);
		expect(s.end()).toEqual([]);
	});
});
