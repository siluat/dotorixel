// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { createStrokeEngine, type StrokeEngineDeps } from './stroke-engine';
import { canvasFactory } from './wasm-backend';
import { SharedState } from './shared-state.svelte';
import { createSamplingSession } from './sampling/session.svelte';
import type { Color } from './color';
import type { PixelCanvas } from './canvas-model';
import type { EditorEffects, ToolRunnerHost } from './tool-runner.svelte';

const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };
const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

interface Setup {
	engine: ReturnType<typeof createStrokeEngine>;
	canvas: PixelCanvas;
	shared: SharedState;
	samplingSession: ReturnType<typeof createSamplingSession>;
	pushSnapshot: ReturnType<typeof vi.fn>;
}

function createSetup(opts?: {
	canvas?: PixelCanvas;
	foregroundColor?: Color;
	backgroundColor?: Color;
	getShiftHeld?: () => boolean;
}): Setup {
	const canvas = opts?.canvas ?? canvasFactory.create(8, 8);
	const fg = opts?.foregroundColor ?? BLACK;
	const bg = opts?.backgroundColor ?? WHITE;
	const host: ToolRunnerHost = {
		get pixelCanvas() {
			return canvas;
		},
		get foregroundColor() {
			return fg;
		},
		get backgroundColor() {
			return bg;
		}
	};
	const shared = new SharedState();
	const samplingSession = createSamplingSession({ getSamplingPort: () => canvas });
	const pushSnapshot = vi.fn();
	const deps: StrokeEngineDeps = {
		host,
		shared,
		history: { pushSnapshot },
		sampling: samplingSession,
		isShiftHeld: opts?.getShiftHeld ?? (() => false)
	};
	const engine = createStrokeEngine(deps);
	return { engine, canvas, shared, samplingSession, pushSnapshot };
}

function getPixel(canvas: PixelCanvas, x: number, y: number): Color {
	const p = canvas.get_pixel(x, y);
	return { r: p.r, g: p.g, b: p.b, a: p.a };
}

function hasEffect(effects: EditorEffects, type: string): boolean {
	return effects.some((e) => e.type === type);
}

// ── input-source mapping ─────────────────────────────────────────────

describe('stroke-engine — input-source mapping', () => {
	// Observed via the loupe's positioning preset (mouse uses an offset, touch
	// centers horizontally). Position is the only externally visible signal of
	// which input-source preset the session adopted.
	function loupePositionFor(pointerType: 'mouse' | 'pen' | 'touch') {
		const { engine, shared, samplingSession } = createSetup();
		shared.activeTool = 'eyedropper';
		const { stroke } = engine.begin({ button: 0, pointerType });
		stroke.sample({ x: 0, y: 0 }, null);
		samplingSession.updatePointer({
			screen: { x: 600, y: 400 },
			viewport: { width: 1200, height: 800 }
		});
		return samplingSession.position;
	}

	it('treats "mouse" and "pen" pointers as the same positioning preset', () => {
		expect(loupePositionFor('pen')).toEqual(loupePositionFor('mouse'));
	});

	it('treats "touch" pointers as a distinct positioning preset from mouse', () => {
		expect(loupePositionFor('touch')).not.toEqual(loupePositionFor('mouse'));
	});
});

// ── tool resolution ──────────────────────────────────────────────────

describe('stroke-engine — tool resolution', () => {
	it('opens the tool at shared.activeTool (pencil paints)', () => {
		const canvas = canvasFactory.create(8, 8);
		const { engine, shared } = createSetup({ canvas });
		shared.activeTool = 'pencil';
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 2, y: 2 }, null);
		stroke.end();
		expect(getPixel(canvas, 2, 2)).toEqual(BLACK);
	});

	it('re-resolves the active tool on each begin() call', () => {
		const canvas = canvasFactory.create(8, 8);
		const { engine, shared } = createSetup({ canvas });
		shared.activeTool = 'pencil';
		const first = engine.begin({ button: 0, pointerType: 'mouse' });
		first.stroke.sample({ x: 3, y: 3 }, null);
		first.stroke.end();
		expect(getPixel(canvas, 3, 3)).toEqual(BLACK);

		shared.activeTool = 'eraser';
		const second = engine.begin({ button: 0, pointerType: 'mouse' });
		second.stroke.sample({ x: 3, y: 3 }, null);
		second.stroke.end();
		expect(getPixel(canvas, 3, 3)).toEqual(TRANSPARENT);
	});
});

// ── mid-stroke isolation ─────────────────────────────────────────────

describe('stroke-engine — mid-stroke isolation', () => {
	it('snapshots activeTool at begin — mid-stroke change does not affect the active stroke', () => {
		const canvas = canvasFactory.create(8, 8);
		const { engine, shared } = createSetup({ canvas });
		shared.activeTool = 'pencil';
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 0, y: 0 }, null);

		// Change activeTool mid-stroke; the active stroke must ignore the change.
		shared.activeTool = 'eraser';
		stroke.sample({ x: 1, y: 1 }, { x: 0, y: 0 });
		stroke.end();

		// Both pixels painted (pencil, not eraser)
		expect(getPixel(canvas, 0, 0)).toEqual(BLACK);
		expect(getPixel(canvas, 1, 1)).toEqual(BLACK);
	});

	it('snapshots pixelPerfect=true at begin — mid-stroke toggle to false keeps the revert behavior', () => {
		const canvas = canvasFactory.create(8, 8);
		const { engine, shared } = createSetup({ canvas });
		shared.activeTool = 'pencil';
		shared.pixelPerfect = true;
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });

		// Toggle PP off after begin; the stroke must keep PP behavior.
		shared.pixelPerfect = false;

		// Paint an L: (0,0) → (1,0) → (1,1). Middle (1,0) should revert.
		stroke.sample({ x: 0, y: 0 }, null);
		stroke.sample({ x: 1, y: 0 }, { x: 0, y: 0 });
		stroke.sample({ x: 1, y: 1 }, { x: 1, y: 0 });
		stroke.end();

		expect(getPixel(canvas, 0, 0)).toEqual(BLACK);
		expect(getPixel(canvas, 1, 0)).toEqual(TRANSPARENT);
		expect(getPixel(canvas, 1, 1)).toEqual(BLACK);
	});

	it('snapshots pixelPerfect=false at begin — mid-stroke toggle to true does not enable the revert', () => {
		const canvas = canvasFactory.create(8, 8);
		const { engine, shared } = createSetup({ canvas });
		shared.activeTool = 'pencil';
		shared.pixelPerfect = false;
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });

		// Toggle PP on after begin; the stroke must keep non-PP behavior.
		shared.pixelPerfect = true;

		stroke.sample({ x: 0, y: 0 }, null);
		stroke.sample({ x: 1, y: 0 }, { x: 0, y: 0 });
		stroke.sample({ x: 1, y: 1 }, { x: 1, y: 0 });
		stroke.end();

		// Without PP, all three pixels stay painted.
		expect(getPixel(canvas, 0, 0)).toEqual(BLACK);
		expect(getPixel(canvas, 1, 0)).toEqual(BLACK);
		expect(getPixel(canvas, 1, 1)).toEqual(BLACK);
	});
});

// ── Start effects folded into begin() ────────────────────────────────

describe('stroke-engine — begin effects', () => {
	it('folds pencil start effects (addRecentColor for left-click foreground) into begin return', () => {
		const { engine } = createSetup({ foregroundColor: BLACK });
		const { effects } = engine.begin({ button: 0, pointerType: 'mouse' });
		expect(hasEffect(effects, 'addRecentColor')).toBe(true);
		const recent = effects.find((e) => e.type === 'addRecentColor');
		expect(recent).toEqual({ type: 'addRecentColor', hex: '#000000' });
	});

	it('uses background color for right-click in the emitted addRecentColor', () => {
		const { engine } = createSetup({ backgroundColor: WHITE });
		const { effects } = engine.begin({ button: 2, pointerType: 'mouse' });
		const recent = effects.find((e) => e.type === 'addRecentColor');
		expect(recent).toEqual({ type: 'addRecentColor', hex: '#ffffff' });
	});

	it('eyedropper emits no start effects', () => {
		const { engine, shared } = createSetup();
		shared.activeTool = 'eyedropper';
		const { effects } = engine.begin({ button: 0, pointerType: 'mouse' });
		expect(effects).toEqual([]);
	});

	it('pushes history snapshot for pencil at begin', () => {
		const { engine, pushSnapshot } = createSetup();
		engine.begin({ button: 0, pointerType: 'mouse' });
		expect(pushSnapshot).toHaveBeenCalledOnce();
	});

	it('does not push history snapshot for eyedropper', () => {
		const { engine, shared, pushSnapshot } = createSetup();
		shared.activeTool = 'eyedropper';
		engine.begin({ button: 0, pointerType: 'mouse' });
		expect(pushSnapshot).not.toHaveBeenCalled();
	});
});

// ── ActiveStroke pass-through ────────────────────────────────────────

describe('stroke-engine — ActiveStroke adapter', () => {
	it('sample forwards to the session draw method', () => {
		const canvas = canvasFactory.create(8, 8);
		const { engine } = createSetup({ canvas });
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		const effects = stroke.sample({ x: 1, y: 1 }, null);
		expect(hasEffect(effects, 'canvasChanged')).toBe(true);
	});

	it('refresh forwards to the session modifierChanged method (shape tool shift-toggle)', () => {
		const canvas = canvasFactory.create(8, 8);
		let shift = false;
		const { engine, shared } = createSetup({ canvas, getShiftHeld: () => shift });
		shared.activeTool = 'line';

		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 0, y: 0 }, null);
		stroke.sample({ x: 5, y: 1 }, { x: 0, y: 0 });
		expect(getPixel(canvas, 5, 1)).toEqual(BLACK);

		shift = true;
		const refreshEffects = stroke.refresh();
		expect(hasEffect(refreshEffects, 'canvasChanged')).toBe(true);

		// Shift-constrained to horizontal: (5,0) painted, (5,1) reverted
		expect(getPixel(canvas, 5, 0)).toEqual(BLACK);
		expect(getPixel(canvas, 5, 1)).toEqual(TRANSPARENT);

		stroke.end();
	});

	it('end returns deferred session effects (eyedropper colorPick commit)', () => {
		const canvas = canvasFactory.create(8, 8);
		// Paint a known-red pixel so the eyedropper has something to pick.
		const red: Color = { r: 255, g: 0, b: 0, a: 255 };
		const { engine: paintEngine } = createSetup({
			canvas,
			foregroundColor: red
		});
		paintEngine.begin({ button: 0, pointerType: 'mouse' }).stroke.sample({ x: 2, y: 2 }, null);
		expect(getPixel(canvas, 2, 2)).toEqual(red);

		// Fresh engine with eyedropper
		const { engine, shared } = createSetup({ canvas });
		shared.activeTool = 'eyedropper';
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 2, y: 2 }, null);
		const endEffects = stroke.end();
		const colorPick = endEffects.find((e) => e.type === 'colorPick');
		expect(colorPick).toEqual({ type: 'colorPick', target: 'foreground', color: red });
	});
});

// ── Move tool (dragTransform customTool) ────────────────────────────

describe('stroke-engine — move tool', () => {
	it('pushes a history snapshot at begin', () => {
		const { engine, shared, pushSnapshot } = createSetup();
		shared.activeTool = 'move';
		engine.begin({ button: 0, pointerType: 'mouse' });
		expect(pushSnapshot).toHaveBeenCalledOnce();
	});

	it('first drag sample sets the anchor without shifting the canvas', () => {
		const canvas = canvasFactory.create(4, 4);
		// Seed (1,1) black so we can verify the first sample does not move it.
		const { engine: seed } = createSetup({ canvas });
		seed.begin({ button: 0, pointerType: 'mouse' }).stroke.sample({ x: 1, y: 1 }, null);
		expect(getPixel(canvas, 1, 1)).toEqual(BLACK);

		const { engine, shared } = createSetup({ canvas });
		shared.activeTool = 'move';
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 2, y: 2 }, null);

		// Anchor captured; canvas unchanged.
		expect(getPixel(canvas, 1, 1)).toEqual(BLACK);
	});

	it('subsequent drag samples shift the snapshot by the delta from the anchor', () => {
		const canvas = canvasFactory.create(4, 4);
		// Seed (0,0) with black.
		const { engine: seed } = createSetup({ canvas });
		seed.begin({ button: 0, pointerType: 'mouse' }).stroke.sample({ x: 0, y: 0 }, null);
		expect(getPixel(canvas, 0, 0)).toEqual(BLACK);

		const { engine, shared } = createSetup({ canvas });
		shared.activeTool = 'move';
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 0, y: 0 }, null); // anchor at (0,0)
		stroke.sample({ x: 2, y: 1 }, { x: 0, y: 0 }); // delta (2,1)
		stroke.end();

		expect(getPixel(canvas, 0, 0)).toEqual(TRANSPARENT);
		expect(getPixel(canvas, 2, 1)).toEqual(BLACK);
	});
});

// ── Eyedropper right-click ──────────────────────────────────────────

describe('stroke-engine — eyedropper right-click', () => {
	it('right-click eyedropper commits to the background target', () => {
		const canvas = canvasFactory.create(4, 4);
		const red: Color = { r: 255, g: 0, b: 0, a: 255 };
		// Seed (1,1) red.
		const { engine: seed } = createSetup({ canvas, foregroundColor: red });
		seed.begin({ button: 0, pointerType: 'mouse' }).stroke.sample({ x: 1, y: 1 }, null);
		expect(getPixel(canvas, 1, 1)).toEqual(red);

		const { engine, shared } = createSetup({ canvas });
		shared.activeTool = 'eyedropper';
		const { stroke } = engine.begin({ button: 2, pointerType: 'mouse' });
		stroke.sample({ x: 1, y: 1 }, null);
		const endEffects = stroke.end();
		const colorPick = endEffects.find((e) => e.type === 'colorPick');
		expect(colorPick).toEqual({ type: 'colorPick', target: 'background', color: red });
	});
});

// ── Pencil pixel-perfect scenarios (engine-boundary) ────────────────

describe('stroke-engine — pencil pixel-perfect', () => {
	it('reverts the L-corner middle pixel when pixelPerfect is enabled', () => {
		const canvas = canvasFactory.create(8, 8);
		const { engine, shared } = createSetup({ canvas });
		shared.activeTool = 'pencil';
		shared.pixelPerfect = true;
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });

		stroke.sample({ x: 0, y: 0 }, null);
		stroke.sample({ x: 1, y: 0 }, { x: 0, y: 0 });
		stroke.sample({ x: 1, y: 1 }, { x: 1, y: 0 });
		stroke.end();

		expect(getPixel(canvas, 0, 0)).toEqual(BLACK);
		expect(getPixel(canvas, 1, 0)).toEqual(TRANSPARENT);
		expect(getPixel(canvas, 1, 1)).toEqual(BLACK);
	});

	it('leaves every pixel of an L-corner stroke painted when pixelPerfect is disabled', () => {
		const canvas = canvasFactory.create(8, 8);
		const { engine, shared } = createSetup({ canvas });
		shared.activeTool = 'pencil';
		shared.pixelPerfect = false;
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });

		stroke.sample({ x: 0, y: 0 }, null);
		stroke.sample({ x: 1, y: 0 }, { x: 0, y: 0 });
		stroke.sample({ x: 1, y: 1 }, { x: 1, y: 0 });
		stroke.end();

		expect(getPixel(canvas, 0, 0)).toEqual(BLACK);
		expect(getPixel(canvas, 1, 0)).toEqual(BLACK);
		expect(getPixel(canvas, 1, 1)).toEqual(BLACK);
	});

	it('preserves the first pre-paint color when a coord is revisited within a PP stroke', () => {
		// Seed (1,0) with white so the first-touch cache has a non-transparent
		// original to preserve under the L-corner revert.
		const canvas = canvasFactory.create(8, 8);
		const fgWhite: Color = { r: 255, g: 255, b: 255, a: 255 };
		const { engine: seed } = createSetup({ canvas, foregroundColor: fgWhite });
		seed.begin({ button: 0, pointerType: 'mouse' }).stroke.sample({ x: 1, y: 0 }, null);
		expect(getPixel(canvas, 1, 0)).toEqual(fgWhite);

		// Now draw black with PP, revisiting (1,0) mid-stroke.
		const { engine, shared } = createSetup({ canvas });
		shared.activeTool = 'pencil';
		shared.pixelPerfect = true;
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 1, y: 0 }, null);
		stroke.sample({ x: 0, y: 0 }, { x: 1, y: 0 });
		stroke.sample({ x: 1, y: 0 }, { x: 0, y: 0 }); // revisit — cache should not update
		stroke.sample({ x: 1, y: 1 }, { x: 1, y: 0 }); // closes L; revert restores white
		stroke.end();

		expect(getPixel(canvas, 1, 0)).toEqual(fgWhite);
	});
});
