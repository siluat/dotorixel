// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createStrokeEngine, type StrokeEngineDeps } from './stroke-engine';
import { canvasFactory, marqueeRegionFromDrag, singleLayerDocument } from './wasm-backend';
import { SharedState } from './shared-state.svelte';
import { createCanvasSamplingSession } from './sampling/session.svelte';
import { createDocumentSamplingPort } from './sampling/adapters/document';
import type { Color } from './color';
import type { Document, PixelCanvas } from './canvas-model';
import type { EditorEffects, ToolRunnerHost } from './tool-runner.svelte';

const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };
const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

interface Setup {
	engine: ReturnType<typeof createStrokeEngine>;
	canvas: PixelCanvas;
	document: Document;
	shared: SharedState;
	samplingSession: ReturnType<typeof createCanvasSamplingSession>;
}

function createSetup(opts?: {
	canvas?: PixelCanvas;
	document?: Document;
	foregroundColor?: Color;
	backgroundColor?: Color;
	getShiftHeld?: () => boolean;
}): Setup {
	const canvas = opts?.canvas ?? canvasFactory.create(8, 8);
	const fg = opts?.foregroundColor ?? BLACK;
	const bg = opts?.backgroundColor ?? WHITE;
	const document: Document =
		opts?.document ?? singleLayerDocument(canvas.width, canvas.height, canvas.pixels());
	const host: ToolRunnerHost = {
		get document() {
			return document;
		},
		get foregroundColor() {
			return fg;
		},
		get backgroundColor() {
			return bg;
		}
	};
	const shared = new SharedState();
	const samplingSession = createCanvasSamplingSession({
		getSamplingPort: () => createDocumentSamplingPort(document)
	});
	const deps: StrokeEngineDeps = {
		host,
		shared,
		sampling: samplingSession,
		isShiftHeld: opts?.getShiftHeld ?? (() => false)
	};
	const engine = createStrokeEngine(deps);
	return { engine, canvas, document, shared, samplingSession };
}

function getDocPixel(doc: Document, x: number, y: number): Color {
	const p = doc.get_pixel(x, y);
	return { r: p.r, g: p.g, b: p.b, a: p.a };
}

function hasEffect(effects: EditorEffects, type: string): boolean {
	return effects.some((e) => e.type === type);
}

function setMarquee(document: Document, x0: number, y0: number, x1: number, y1: number): void {
	document.set_marquee(marqueeRegionFromDrag(x0, y0, x1, y1));
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
		const { engine, shared, document } = createSetup({ canvas });
		shared.activeTool = 'pencil';
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 2, y: 2 }, null);
		stroke.end();
		expect(getDocPixel(document, 2, 2)).toEqual(BLACK);
	});

	it('re-resolves the active tool on each begin() call', () => {
		const canvas = canvasFactory.create(8, 8);
		const { engine, shared, document } = createSetup({ canvas });
		shared.activeTool = 'pencil';
		const first = engine.begin({ button: 0, pointerType: 'mouse' });
		first.stroke.sample({ x: 3, y: 3 }, null);
		first.stroke.end();
		expect(getDocPixel(document, 3, 3)).toEqual(BLACK);

		shared.activeTool = 'eraser';
		const second = engine.begin({ button: 0, pointerType: 'mouse' });
		second.stroke.sample({ x: 3, y: 3 }, null);
		second.stroke.end();
		expect(getDocPixel(document, 3, 3)).toEqual(TRANSPARENT);
	});
});

// ── mid-stroke isolation ─────────────────────────────────────────────

describe('stroke-engine — mid-stroke isolation', () => {
	it('snapshots activeTool at begin — mid-stroke change does not affect the active stroke', () => {
		const canvas = canvasFactory.create(8, 8);
		const { engine, shared, document } = createSetup({ canvas });
		shared.activeTool = 'pencil';
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 0, y: 0 }, null);

		// Change activeTool mid-stroke; the active stroke must ignore the change.
		shared.activeTool = 'eraser';
		stroke.sample({ x: 1, y: 1 }, { x: 0, y: 0 });
		stroke.end();

		// Both pixels painted (pencil, not eraser)
		expect(getDocPixel(document, 0, 0)).toEqual(BLACK);
		expect(getDocPixel(document, 1, 1)).toEqual(BLACK);
	});

	it('snapshots pixelPerfect=true at begin — mid-stroke toggle to false keeps the revert behavior', () => {
		const canvas = canvasFactory.create(8, 8);
		const { engine, shared, document } = createSetup({ canvas });
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

		expect(getDocPixel(document, 0, 0)).toEqual(BLACK);
		expect(getDocPixel(document, 1, 0)).toEqual(TRANSPARENT);
		expect(getDocPixel(document, 1, 1)).toEqual(BLACK);
	});

	it('snapshots pixelPerfect=false at begin — mid-stroke toggle to true does not enable the revert', () => {
		const canvas = canvasFactory.create(8, 8);
		const { engine, shared, document } = createSetup({ canvas });
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
		expect(getDocPixel(document, 0, 0)).toEqual(BLACK);
		expect(getDocPixel(document, 1, 0)).toEqual(BLACK);
		expect(getDocPixel(document, 1, 1)).toEqual(BLACK);
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

	it('emits an undo snapshot request for pencil at begin', () => {
		const { engine } = createSetup();
		const { effects } = engine.begin({ button: 0, pointerType: 'mouse' });
		expect(effects).toContainEqual({ type: 'beginEdit' });
	});

	it('does not emit an undo snapshot request for eyedropper', () => {
		const { engine, shared } = createSetup();
		shared.activeTool = 'eyedropper';
		const { effects } = engine.begin({ button: 0, pointerType: 'mouse' });
		expect(effects).not.toContainEqual({ type: 'beginEdit' });
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
		let shift = false;
		const { engine, document, shared } = createSetup({ getShiftHeld: () => shift });
		shared.activeTool = 'line';

		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 0, y: 0 }, null);
		stroke.sample({ x: 5, y: 1 }, { x: 0, y: 0 });
		expect(getDocPixel(document, 5, 1)).toEqual(BLACK);

		shift = true;
		const refreshEffects = stroke.refresh();
		expect(hasEffect(refreshEffects, 'canvasChanged')).toBe(true);

		// Shift-constrained to horizontal: (5,0) painted, (5,1) reverted
		expect(getDocPixel(document, 5, 0)).toEqual(BLACK);
		expect(getDocPixel(document, 5, 1)).toEqual(TRANSPARENT);

		stroke.end();
	});

	it('end returns deferred session effects (eyedropper colorPick commit)', () => {
		const canvas = canvasFactory.create(8, 8);
		// Paint a known-red pixel so the eyedropper has something to pick.
		const red: Color = { r: 255, g: 0, b: 0, a: 255 };
		const { engine: paintEngine, document } = createSetup({
			canvas,
			foregroundColor: red
		});
		paintEngine.begin({ button: 0, pointerType: 'mouse' }).stroke.sample({ x: 2, y: 2 }, null);
		expect(getDocPixel(document, 2, 2)).toEqual(red);

		// Fresh engine with eyedropper, sharing the same document.
		const { engine, shared } = createSetup({ canvas, document });
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
	it('emits an undo snapshot request at begin', () => {
		const { engine, shared } = createSetup();
		shared.activeTool = 'move';
		const { effects } = engine.begin({ button: 0, pointerType: 'mouse' });
		expect(effects).toContainEqual({ type: 'beginEdit' });
	});

	it('first drag sample sets the anchor without shifting the canvas', () => {
		const canvas = canvasFactory.create(4, 4);
		// Seed (1,1) black so we can verify the first sample does not move it.
		const { engine: seed, document } = createSetup({ canvas });
		seed.begin({ button: 0, pointerType: 'mouse' }).stroke.sample({ x: 1, y: 1 }, null);
		expect(getDocPixel(document, 1, 1)).toEqual(BLACK);

		const { engine, shared } = createSetup({ canvas, document });
		shared.activeTool = 'move';
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 2, y: 2 }, null);

		// Anchor captured; document unchanged.
		expect(getDocPixel(document, 1, 1)).toEqual(BLACK);
	});

	it('subsequent drag samples shift the snapshot by the delta from the anchor', () => {
		const canvas = canvasFactory.create(4, 4);
		const document = singleLayerDocument(canvas.width, canvas.height, canvas.pixels());
		// Seed (0,0) with black via a pencil tap.
		const { engine: seed } = createSetup({ canvas, document });
		seed.begin({ button: 0, pointerType: 'mouse' }).stroke.sample({ x: 0, y: 0 }, null);
		expect(getDocPixel(document, 0, 0)).toEqual(BLACK);

		const { engine, shared } = createSetup({ canvas, document });
		shared.activeTool = 'move';
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 0, y: 0 }, null); // anchor at (0,0)
		stroke.sample({ x: 2, y: 1 }, { x: 0, y: 0 }); // delta (2,1)
		stroke.end();

		expect(getDocPixel(document, 0, 0)).toEqual(TRANSPARENT);
		expect(getDocPixel(document, 2, 1)).toEqual(BLACK);
	});
});

// ── Eyedropper right-click ──────────────────────────────────────────

describe('stroke-engine — eyedropper right-click', () => {
	it('right-click eyedropper commits to the background target', () => {
		const canvas = canvasFactory.create(4, 4);
		const red: Color = { r: 255, g: 0, b: 0, a: 255 };
		// Seed (1,1) red.
		const { engine: seed, document } = createSetup({ canvas, foregroundColor: red });
		seed.begin({ button: 0, pointerType: 'mouse' }).stroke.sample({ x: 1, y: 1 }, null);
		expect(getDocPixel(document, 1, 1)).toEqual(red);

		const { engine, shared } = createSetup({ canvas, document });
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
		const { engine, shared, document } = createSetup({ canvas });
		shared.activeTool = 'pencil';
		shared.pixelPerfect = true;
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });

		stroke.sample({ x: 0, y: 0 }, null);
		stroke.sample({ x: 1, y: 0 }, { x: 0, y: 0 });
		stroke.sample({ x: 1, y: 1 }, { x: 1, y: 0 });
		stroke.end();

		expect(getDocPixel(document, 0, 0)).toEqual(BLACK);
		expect(getDocPixel(document, 1, 0)).toEqual(TRANSPARENT);
		expect(getDocPixel(document, 1, 1)).toEqual(BLACK);
	});

	it('leaves every pixel of an L-corner stroke painted when pixelPerfect is disabled', () => {
		const canvas = canvasFactory.create(8, 8);
		const { engine, shared, document } = createSetup({ canvas });
		shared.activeTool = 'pencil';
		shared.pixelPerfect = false;
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });

		stroke.sample({ x: 0, y: 0 }, null);
		stroke.sample({ x: 1, y: 0 }, { x: 0, y: 0 });
		stroke.sample({ x: 1, y: 1 }, { x: 1, y: 0 });
		stroke.end();

		expect(getDocPixel(document, 0, 0)).toEqual(BLACK);
		expect(getDocPixel(document, 1, 0)).toEqual(BLACK);
		expect(getDocPixel(document, 1, 1)).toEqual(BLACK);
	});

	it('preserves the first pre-paint color when a coord is revisited within a PP stroke', () => {
		// Seed (1,0) with white so the first-touch cache has a non-transparent
		// original to preserve under the L-corner revert.
		const canvas = canvasFactory.create(8, 8);
		const fgWhite: Color = { r: 255, g: 255, b: 255, a: 255 };
		const { engine: seed, document } = createSetup({ canvas, foregroundColor: fgWhite });
		seed.begin({ button: 0, pointerType: 'mouse' }).stroke.sample({ x: 1, y: 0 }, null);
		expect(getDocPixel(document, 1, 0)).toEqual(fgWhite);

		// Now draw black with PP, revisiting (1,0) mid-stroke.
		const { engine, shared } = createSetup({ canvas, document });
		shared.activeTool = 'pencil';
		shared.pixelPerfect = true;
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 1, y: 0 }, null);
		stroke.sample({ x: 0, y: 0 }, { x: 1, y: 0 });
		stroke.sample({ x: 1, y: 0 }, { x: 0, y: 0 }); // revisit — cache should not update
		stroke.sample({ x: 1, y: 1 }, { x: 1, y: 0 }); // closes L; revert restores white
		stroke.end();

		expect(getDocPixel(document, 1, 0)).toEqual(fgWhite);
	});
});

// ── Marquee clipping ───────────────────────────────────────────────

describe('stroke-engine — Marquee clipping', () => {
	it('clips pencil strokes to the active Marquee', () => {
		const { engine, shared, document } = createSetup();
		setMarquee(document, 1, 1, 2, 2);
		shared.activeTool = 'pencil';

		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 0, y: 0 }, null);
		stroke.sample({ x: 1, y: 1 }, { x: 0, y: 0 });
		stroke.sample({ x: 3, y: 3 }, { x: 1, y: 1 });
		stroke.end();

		expect(getDocPixel(document, 0, 0)).toEqual(TRANSPARENT);
		expect(getDocPixel(document, 1, 1)).toEqual(BLACK);
		expect(getDocPixel(document, 2, 2)).toEqual(BLACK);
		expect(getDocPixel(document, 3, 3)).toEqual(TRANSPARENT);
	});

	it('clips eraser strokes to the active Marquee', () => {
		const { engine, shared, document } = createSetup();
		shared.activeTool = 'pencil';
		let active = engine.begin({ button: 0, pointerType: 'mouse' }).stroke;
		active.sample({ x: 0, y: 0 }, null);
		active.sample({ x: 1, y: 1 }, { x: 0, y: 0 });
		active.end();
		expect(getDocPixel(document, 0, 0)).toEqual(BLACK);
		expect(getDocPixel(document, 1, 1)).toEqual(BLACK);

		setMarquee(document, 1, 1, 2, 2);
		shared.activeTool = 'eraser';
		active = engine.begin({ button: 0, pointerType: 'mouse' }).stroke;
		active.sample({ x: 0, y: 0 }, null);
		active.sample({ x: 1, y: 1 }, { x: 0, y: 0 });
		active.end();

		expect(getDocPixel(document, 0, 0)).toEqual(BLACK);
		expect(getDocPixel(document, 1, 1)).toEqual(TRANSPARENT);
	});

	it('clips line strokes to the active Marquee', () => {
		const { engine, shared, document } = createSetup();
		setMarquee(document, 1, 1, 2, 2);
		shared.activeTool = 'line';

		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 0, y: 1 }, null);
		stroke.sample({ x: 3, y: 1 }, { x: 0, y: 1 });
		stroke.end();

		expect(getDocPixel(document, 0, 1)).toEqual(TRANSPARENT);
		expect(getDocPixel(document, 1, 1)).toEqual(BLACK);
		expect(getDocPixel(document, 2, 1)).toEqual(BLACK);
		expect(getDocPixel(document, 3, 1)).toEqual(TRANSPARENT);
	});

	it('clips rectangle strokes to the active Marquee', () => {
		const { engine, shared, document } = createSetup();
		setMarquee(document, 1, 1, 2, 2);
		shared.activeTool = 'rectangle';

		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 1, y: 1 }, null);
		stroke.sample({ x: 3, y: 3 }, { x: 1, y: 1 });
		stroke.end();

		expect(getDocPixel(document, 1, 1)).toEqual(BLACK);
		expect(getDocPixel(document, 2, 1)).toEqual(BLACK);
		expect(getDocPixel(document, 1, 2)).toEqual(BLACK);
		expect(getDocPixel(document, 3, 1)).toEqual(TRANSPARENT);
	});

	it('clips ellipse strokes to the active Marquee', () => {
		const { engine, shared, document } = createSetup();
		setMarquee(document, 1, 1, 2, 2);
		shared.activeTool = 'ellipse';

		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 1, y: 1 }, null);
		stroke.sample({ x: 3, y: 3 }, { x: 1, y: 1 });
		stroke.end();

		expect(getDocPixel(document, 2, 1)).toEqual(BLACK);
		expect(getDocPixel(document, 1, 2)).toEqual(BLACK);
		expect(getDocPixel(document, 3, 2)).toEqual(TRANSPARENT);
	});

	it('clips flood fill to the active Marquee', () => {
		const { engine, shared, document } = createSetup();
		setMarquee(document, 1, 1, 2, 2);
		shared.activeTool = 'floodfill';

		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 1, y: 1 }, null);
		stroke.end();

		expect(getDocPixel(document, 0, 1)).toEqual(TRANSPARENT);
		expect(getDocPixel(document, 1, 1)).toEqual(BLACK);
		expect(getDocPixel(document, 2, 2)).toEqual(BLACK);
		expect(getDocPixel(document, 3, 2)).toEqual(TRANSPARENT);
	});

	it('keeps move tool as a full-layer translation when a Marquee is active', () => {
		const { engine, shared, document } = createSetup();
		shared.activeTool = 'pencil';
		engine.begin({ button: 0, pointerType: 'mouse' }).stroke.sample({ x: 0, y: 0 }, null);
		expect(getDocPixel(document, 0, 0)).toEqual(BLACK);

		setMarquee(document, 2, 2, 3, 3);
		shared.activeTool = 'move';
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 0, y: 0 }, null);
		stroke.sample({ x: 2, y: 0 }, { x: 0, y: 0 });
		stroke.end();

		expect(getDocPixel(document, 0, 0)).toEqual(TRANSPARENT);
		expect(getDocPixel(document, 2, 0)).toEqual(BLACK);
	});

	it('keeps eyedropper sampling outside the Marquee', () => {
		const red: Color = { r: 255, g: 0, b: 0, a: 255 };
		const { engine: seed, document } = createSetup({ foregroundColor: red });
		seed.begin({ button: 0, pointerType: 'mouse' }).stroke.sample({ x: 0, y: 0 }, null);

		const { engine, shared } = createSetup({ document });
		setMarquee(document, 2, 2, 3, 3);
		shared.activeTool = 'eyedropper';
		const { stroke } = engine.begin({ button: 0, pointerType: 'mouse' });
		stroke.sample({ x: 0, y: 0 }, null);
		const colorPick = stroke.end().find((e) => e.type === 'colorPick');

		expect(colorPick).toEqual({ type: 'colorPick', target: 'foreground', color: red });
	});
});
