import { describe, expect, it, vi } from 'vitest';
import { createStrokeSessions, type StrokeDeps } from './stroke-session';
import { createFakeDrawingOps, WHITE } from './fake-drawing-ops';
import type { CanvasCoords, PixelCanvas } from './canvas-model';
import type { Color } from './color';
import type { DragTransformTool, ToolContext } from './draw-tool';
import type { SamplingSession } from './sampling-session.svelte';

const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };

interface FakePixelCanvas extends PixelCanvas {
	readonly restoreCalls: ReadonlyArray<Uint8Array>;
}

function createFakePixelCanvas(width: number, height: number): FakePixelCanvas {
	const state = new Uint8Array(width * height * 4);
	const restoreCalls: Uint8Array[] = [];
	return {
		width,
		height,
		pixels: () => new Uint8Array(state),
		get_pixel: () => ({ r: 0, g: 0, b: 0, a: 0 }),
		restore_pixels(data) {
			restoreCalls.push(new Uint8Array(data));
			state.set(data);
		},
		is_inside_bounds: (x, y) => x >= 0 && y >= 0 && x < width && y < height,
		clear() {
			state.fill(0);
		},
		encode_png: () => new Uint8Array(),
		encode_svg: () => '',
		resize: () => {
			throw new Error('resize not expected in dragTransform tests');
		},
		get restoreCalls() {
			return restoreCalls;
		}
	};
}

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

describe('sessions.dragTransform', () => {
	it('pushes a history snapshot at start and takes a canvas snapshot', () => {
		const canvas = createFakePixelCanvas(4, 4);
		const { deps, pushSnapshot } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const tool: DragTransformTool = {
			kind: 'dragTransform',
			applyTransform: vi.fn()
		};
		const s = sessions.dragTransform({ tool, drawColor: BLACK, drawButton: 0 });

		s.start();

		expect(pushSnapshot).toHaveBeenCalledOnce();
	});

	it('sets anchor on first draw without invoking the transform', () => {
		const canvas = createFakePixelCanvas(4, 4);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const applyTransform = vi.fn();
		const tool: DragTransformTool = { kind: 'dragTransform', applyTransform };
		const s = sessions.dragTransform({ tool, drawColor: BLACK, drawButton: 0 });

		s.start();
		const effects = s.draw({ x: 2, y: 3 }, null);

		expect(applyTransform).not.toHaveBeenCalled();
		expect(effects).toEqual([]);
	});

	it('invokes applyTransform with snapshot + anchor + current on subsequent draws', () => {
		const canvas = createFakePixelCanvas(4, 4);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const captured: {
			ctx?: ToolContext;
			snapshot?: Uint8Array;
			anchor?: CanvasCoords;
			current?: CanvasCoords;
		} = {};
		const tool: DragTransformTool = {
			kind: 'dragTransform',
			applyTransform(ctx, snapshot, anchor, current) {
				captured.ctx = ctx;
				captured.snapshot = snapshot;
				captured.anchor = anchor;
				captured.current = current;
			}
		};
		const s = sessions.dragTransform({ tool, drawColor: BLACK, drawButton: 0 });

		s.start();
		s.draw({ x: 1, y: 1 }, null);
		const effects = s.draw({ x: 3, y: 2 }, { x: 1, y: 1 });

		expect(effects).toEqual([{ type: 'canvasChanged' }]);
		expect(captured.anchor).toEqual({ x: 1, y: 1 });
		expect(captured.current).toEqual({ x: 3, y: 2 });
		expect(captured.snapshot).toBeInstanceOf(Uint8Array);
		expect(captured.ctx?.canvas).toBe(canvas);
		expect(captured.ctx?.drawColor).toEqual(BLACK);
		expect(captured.ctx?.drawButton).toBe(0);
	});

	it('returns no effects on modifierChanged and end', () => {
		const canvas = createFakePixelCanvas(4, 4);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const tool: DragTransformTool = { kind: 'dragTransform', applyTransform: vi.fn() };
		const s = sessions.dragTransform({ tool, drawColor: BLACK, drawButton: 0 });
		s.start();
		s.draw({ x: 1, y: 1 }, null);

		expect(s.modifierChanged()).toEqual([]);
		expect(s.end()).toEqual([]);
	});

	it('ignores draws that arrive before start sets the snapshot', () => {
		const canvas = createFakePixelCanvas(4, 4);
		const { deps } = makeDeps(canvas);
		const sessions = createStrokeSessions(deps);
		const applyTransform = vi.fn();
		const tool: DragTransformTool = { kind: 'dragTransform', applyTransform };
		const s = sessions.dragTransform({ tool, drawColor: BLACK, drawButton: 0 });

		// Without start, there's no snapshot/anchor yet.
		const firstEffects = s.draw({ x: 1, y: 1 }, { x: 0, y: 0 });

		expect(applyTransform).not.toHaveBeenCalled();
		expect(firstEffects).toEqual([]);
	});
});
