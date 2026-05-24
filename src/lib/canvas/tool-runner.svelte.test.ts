// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createToolRunner, type ToolRunnerHost, type ToolRunnerDeps, type EditorEffects } from './tool-runner.svelte';
import { createSamplingSession } from './sampling/session.svelte';
import { SharedState } from './shared-state.svelte';
import type { Color } from './color';
import type { Document, PixelCanvas } from './canvas-model';
import type { ToolType } from './tool-registry';
import { canvasFactory, singleLayerDocument } from './wasm-backend';

const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };
const RED: Color = { r: 255, g: 0, b: 0, a: 255 };

function createHost(
	canvas?: PixelCanvas,
	fg?: Color,
	bg?: Color,
	doc?: Document
): ToolRunnerHost {
	const pixelCanvas = canvas ?? canvasFactory.create(8, 8);
	const document: Document =
		doc ?? singleLayerDocument(pixelCanvas.width, pixelCanvas.height, pixelCanvas.pixels());
	let foregroundColor = fg ?? BLACK;
	let backgroundColor = bg ?? WHITE;
	return {
		get document() {
			return document;
		},
		get foregroundColor() {
			return foregroundColor;
		},
		set foregroundColor(c: Color) {
			foregroundColor = c;
		},
		get backgroundColor() {
			return backgroundColor;
		},
		set backgroundColor(c: Color) {
			backgroundColor = c;
		}
	} as ToolRunnerHost;
}

function createRunner(canvas?: PixelCanvas, fg?: Color, bg?: Color, doc?: Document) {
	const host = createHost(canvas, fg, bg, doc);
	const shared = new SharedState();
	const samplingSession = createSamplingSession({ getSamplingPort: () => host.document });
	const runner = createToolRunner({ host, shared, getShiftHeld: () => false, samplingSession });
	return { host, shared, runner, samplingSession };
}

function createReferenceActiveDocument(pixelLayerPixels?: Uint8Array): Document {
	const doc = singleLayerDocument(8, 8, pixelLayerPixels ?? new Uint8Array(8 * 8 * 4));
	doc.add_reference_layer(
		crypto.randomUUID(),
		'Reference',
		new Uint8Array([255, 0, 0, 255]),
		1,
		1
	);
	return doc;
}

function getFirstPixelLayerPixels(doc: Document): Uint8Array {
	for (let i = 0; i < doc.layer_count(); i++) {
		if (doc.layer_kind_at(i) !== 'pixel') continue;

		const pixels = doc.layer_pixels_at(i);
		if (!pixels) throw new Error(`Layer ${i} is Pixel-kind but has no pixel buffer`);
		return pixels;
	}

	throw new Error('Reference-active test document has no Pixel Layer');
}

function getDocPixel(doc: Document, x: number, y: number) {
	const p = doc.get_pixel(x, y);
	return { r: p.r, g: p.g, b: p.b, a: p.a };
}

function hasEffect(effects: EditorEffects, type: string): boolean {
	return effects.some((e) => e.type === type);
}

// ── Draw lifecycle effects ──────────────────────────────────────────

describe('ToolRunner — pencil tool', () => {
	it('produces canvasChanged and addRecentColor effects', () => {
		const { runner } = createRunner();
		const startEffects = runner.drawStart(0, 'mouse');
		expect(hasEffect(startEffects, 'addRecentColor')).toBe(true);

		const drawEffects = runner.draw({ x: 3, y: 3 }, null);
		expect(hasEffect(drawEffects, 'canvasChanged')).toBe(true);

		runner.drawEnd();
	});

	it('draws a pixel on the active layer', () => {
		const canvas = canvasFactory.create(8, 8);
		const { host, runner } = createRunner(canvas);
		runner.drawStart(0, 'mouse');
		runner.draw({ x: 3, y: 3 }, null);
		runner.drawEnd();

		expect(getDocPixel(host.document, 3, 3)).toEqual(BLACK);
	});
});

describe('ToolRunner — Reference Layer active', () => {
	const drawingTools: readonly ToolType[] = [
		'pencil',
		'eraser',
		'floodfill',
		'line',
		'rectangle',
		'ellipse'
	];

	it.each(drawingTools)('%s silently no-ops without mutating pixels', (tool) => {
		const doc = createReferenceActiveDocument();
		const { runner, shared } = createRunner(undefined, BLACK, WHITE, doc);
		shared.activeTool = tool;
		const beforeComposite = Array.from(doc.composite());

		const startEffects = runner.drawStart(0, 'mouse');
		const firstDrawEffects = runner.draw({ x: 1, y: 1 }, null);
		const dragEffects = runner.draw({ x: 3, y: 3 }, { x: 1, y: 1 });
		const endEffects = runner.drawEnd();

		expect(startEffects).toEqual([]);
		expect(firstDrawEffects).toEqual([]);
		expect(dragEffects).toEqual([]);
		expect(endEffects).toEqual([]);
		expect(Array.from(doc.composite())).toEqual(beforeComposite);
		expect(runner.canUndo).toBe(false);
	});

	it('move silently no-ops instead of shifting Pixel Layer pixels', () => {
		const pixelLayerPixels = new Uint8Array(8 * 8 * 4);
		pixelLayerPixels.set([0, 0, 0, 255], 0);
		const doc = createReferenceActiveDocument(pixelLayerPixels);
		const { runner, shared } = createRunner(undefined, BLACK, WHITE, doc);
		shared.activeTool = 'move';
		const beforeComposite = Array.from(doc.composite());
		const beforePixelLayer = Array.from(getFirstPixelLayerPixels(doc));

		const startEffects = runner.drawStart(0, 'mouse');
		const firstDrawEffects = runner.draw({ x: 0, y: 0 }, null);
		const dragEffects = runner.draw({ x: 2, y: 3 }, { x: 0, y: 0 });
		const endEffects = runner.drawEnd();

		expect(startEffects).toEqual([]);
		expect(firstDrawEffects).toEqual([]);
		expect(dragEffects).toEqual([]);
		expect(endEffects).toEqual([]);
		expect(Array.from(doc.composite())).toEqual(beforeComposite);
		expect(Array.from(getFirstPixelLayerPixels(doc))).toEqual(beforePixelLayer);
		expect(runner.canUndo).toBe(false);
	});
});

describe('ToolRunner — eyedropper tool', () => {
	it('commits colorPick on drawEnd, not mid-stroke', () => {
		const canvas = canvasFactory.create(8, 8);
		// Paint a red pixel at (2,2) using a separate runner with red foreground
		const host = createHost(canvas, RED, WHITE);
		const shared2 = new SharedState();
		const samplingSession2 = createSamplingSession({ getSamplingPort: () => host.document });
		const runner2 = createToolRunner({ host, shared: shared2, getShiftHeld: () => false, samplingSession: samplingSession2 });
		runner2.drawStart(0, 'mouse');
		runner2.draw({ x: 2, y: 2 }, null);
		runner2.drawEnd();
		expect(getDocPixel(host.document, 2, 2)).toEqual(RED);

		// Eyedropper: no colorPick mid-stroke; commit happens on drawEnd.
		const { runner, shared } = createRunner(canvas, undefined, undefined, host.document);
		shared.activeTool = 'eyedropper';
		runner.drawStart(0, 'mouse');
		const drawEffects = runner.draw({ x: 2, y: 2 }, null);
		expect(hasEffect(drawEffects, 'colorPick')).toBe(false);

		const endEffects = runner.drawEnd();
		expect(hasEffect(endEffects, 'colorPick')).toBe(true);
		expect(hasEffect(endEffects, 'canvasChanged')).toBe(false);
		const colorPickEffect = endEffects.find((e) => e.type === 'colorPick');
		expect(colorPickEffect).toEqual({ type: 'colorPick', target: 'foreground', color: RED });
	});

	it('commits the color at the final drag position, not the starting one', () => {
		const canvas = canvasFactory.create(8, 8);
		// Fill the canvas with red at (5,5) using pencil with red foreground
		const redHost = createHost(canvas, RED, WHITE);
		const redShared = new SharedState();
		const redSession = createSamplingSession({ getSamplingPort: () => redHost.document });
		const redRunner = createToolRunner({ host: redHost, shared: redShared, getShiftHeld: () => false, samplingSession: redSession });
		redRunner.drawStart(0, 'mouse');
		redRunner.draw({ x: 5, y: 5 }, null);
		redRunner.drawEnd();
		expect(getDocPixel(redHost.document, 5, 5)).toEqual(RED);
		// (0,0) remains transparent

		// Eyedropper drag: start on transparent (0,0), end on red (5,5). Commit should be RED.
		const { runner, shared } = createRunner(canvas, undefined, undefined, redHost.document);
		shared.activeTool = 'eyedropper';
		runner.drawStart(0, 'mouse');
		runner.draw({ x: 0, y: 0 }, null);
		runner.draw({ x: 5, y: 5 }, { x: 0, y: 0 });
		const endEffects = runner.drawEnd();

		const colorPickEffect = endEffects.find((e) => e.type === 'colorPick');
		expect(colorPickEffect).toEqual({ type: 'colorPick', target: 'foreground', color: RED });
	});

	it('does not push a history snapshot', () => {
		const { runner, shared } = createRunner();
		shared.activeTool = 'eyedropper';
		runner.drawStart(0, 'mouse');
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();

		expect(runner.canUndo).toBe(false);
	});
});

describe('ToolRunner — floodfill tool', () => {
	it('fills on first draw, ignores subsequent drags', () => {
		const canvas = canvasFactory.create(4, 4);
		const { runner, shared } = createRunner(canvas);
		shared.activeTool = 'floodfill';

		runner.drawStart(0, 'mouse');
		const firstDraw = runner.draw({ x: 0, y: 0 }, null);
		expect(hasEffect(firstDraw, 'canvasChanged')).toBe(true);

		const secondDraw = runner.draw({ x: 1, y: 1 }, { x: 0, y: 0 });
		expect(hasEffect(secondDraw, 'canvasChanged')).toBe(false);

		runner.drawEnd();
	});
});

describe('ToolRunner — shape tool', () => {
	it('draws a line and produces correct effects', () => {
		const canvas = canvasFactory.create(8, 8);
		const { host, runner, shared } = createRunner(canvas);
		shared.activeTool = 'line';

		runner.drawStart(0, 'mouse');
		runner.draw({ x: 0, y: 0 }, null);
		const drawEffects = runner.draw({ x: 3, y: 0 }, { x: 0, y: 0 });
		expect(hasEffect(drawEffects, 'canvasChanged')).toBe(true);
		runner.drawEnd();

		for (let x = 0; x <= 3; x++) {
			expect(getDocPixel(host.document, x, 0)).toEqual(BLACK);
		}
	});

	it('cleans up preview artifacts on drawEnd', () => {
		const { host, runner, shared } = createRunner();
		shared.activeTool = 'line';

		runner.drawStart(0, 'mouse');
		runner.draw({ x: 0, y: 0 }, null);
		runner.draw({ x: 4, y: 4 }, { x: 0, y: 0 });
		// Intermediate preview drawn
		expect(getDocPixel(host.document, 2, 2)).toEqual(BLACK);

		// Change to final position
		runner.draw({ x: 3, y: 0 }, { x: 4, y: 4 });
		// Intermediate preview cleaned
		expect(getDocPixel(host.document, 2, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });

		runner.drawEnd();
	});
});

describe('ToolRunner — move tool', () => {
	it('shifts canvas content and produces canvasChanged', () => {
		const { host, runner, shared } = createRunner();

		// Paint a pixel with pencil
		shared.activeTool = 'pencil';
		runner.drawStart(0, 'mouse');
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();
		expect(getDocPixel(host.document, 0, 0)).toEqual(BLACK);

		// Move it
		shared.activeTool = 'move';
		runner.drawStart(0, 'mouse');
		runner.draw({ x: 0, y: 0 }, null);
		const moveEffects = runner.draw({ x: 2, y: 3 }, { x: 0, y: 0 });
		expect(hasEffect(moveEffects, 'canvasChanged')).toBe(true);
		runner.drawEnd();

		expect(getDocPixel(host.document, 2, 3)).toEqual(BLACK);
		expect(getDocPixel(host.document, 0, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});
});

describe('ToolRunner — eraser tool', () => {
	it('erases pixels to transparent', () => {
		const canvas = canvasFactory.create(8, 8);
		const { host, runner, shared } = createRunner(canvas);

		// Paint a pixel with pencil
		shared.activeTool = 'pencil';
		runner.drawStart(0, 'mouse');
		runner.draw({ x: 3, y: 3 }, null);
		runner.drawEnd();
		expect(getDocPixel(host.document, 3, 3)).toEqual(BLACK);

		// Erase it
		shared.activeTool = 'eraser';
		runner.drawStart(0, 'mouse');
		runner.draw({ x: 3, y: 3 }, null);
		runner.drawEnd();

		expect(getDocPixel(host.document, 3, 3)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});

	it('does not produce addRecentColor effect', () => {
		const { runner, shared } = createRunner();
		shared.activeTool = 'eraser';
		const startEffects = runner.drawStart(0, 'mouse');
		expect(hasEffect(startEffects, 'addRecentColor')).toBe(false);
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();
	});
});

// ── addsActiveColor flag ──────────────────────────────────────────

describe('ToolRunner — addsActiveColor', () => {
	it('pencil emits addRecentColor with foreground hex on left-click', () => {
		const { runner } = createRunner();
		const effects = runner.drawStart(0, 'mouse');
		const recentColor = effects.find((e) => e.type === 'addRecentColor');
		expect(recentColor).toEqual({ type: 'addRecentColor', hex: '#000000' });
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();
	});

	it('pencil emits addRecentColor with background hex on right-click', () => {
		const { runner } = createRunner();
		const effects = runner.drawStart(2, 'mouse');
		const recentColor = effects.find((e) => e.type === 'addRecentColor');
		expect(recentColor).toEqual({ type: 'addRecentColor', hex: '#ffffff' });
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();
	});

	it('eyedropper does not emit addRecentColor on drawStart', () => {
		const { runner, shared } = createRunner();
		shared.activeTool = 'eyedropper';
		const effects = runner.drawStart(0, 'mouse');
		expect(hasEffect(effects, 'addRecentColor')).toBe(false);
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();
	});

	it('floodfill emits addRecentColor on drawStart', () => {
		const { runner, shared } = createRunner();
		shared.activeTool = 'floodfill';
		const effects = runner.drawStart(0, 'mouse');
		expect(hasEffect(effects, 'addRecentColor')).toBe(true);
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();
	});

	it('line tool emits addRecentColor on drawStart', () => {
		const { runner, shared } = createRunner();
		shared.activeTool = 'line';
		const effects = runner.drawStart(0, 'mouse');
		expect(hasEffect(effects, 'addRecentColor')).toBe(true);
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();
	});
});

// ── Right-click uses background color ───────────────────────────────

describe('ToolRunner — right-click', () => {
	it('uses background color for pencil on right-click', () => {
		const canvas = canvasFactory.create(8, 8);
		const { host, runner } = createRunner(canvas);

		runner.drawStart(2, 'mouse');
		runner.draw({ x: 3, y: 3 }, null);
		runner.drawEnd();

		expect(getDocPixel(host.document, 3, 3)).toEqual(WHITE);
	});
});

// ── History behavior ────────────────────────────────────────────────

describe('ToolRunner — history', () => {
	it('pushes snapshot for capturesHistory tools', () => {
		const { runner } = createRunner();
		runner.drawStart(0, 'mouse');
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();

		expect(runner.canUndo).toBe(true);
	});

	it('undo returns documentReplaced effect carrying the previous document', () => {
		const { runner } = createRunner();
		runner.drawStart(0, 'mouse');
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();

		const effects = runner.undo();
		const replaced = effects.find((e) => e.type === 'documentReplaced');
		expect(replaced).toBeDefined();
		if (replaced && replaced.type === 'documentReplaced') {
			const i = (0 * replaced.document.width + 0) * 4;
			const layer = replaced.document.layer_pixels_at(0)!;
			expect(Array.from(layer.slice(i, i + 4))).toEqual([0, 0, 0, 0]);
		}
	});

	it('redo returns documentReplaced effect carrying the post-draw document', () => {
		const { runner } = createRunner();
		runner.drawStart(0, 'mouse');
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();

		runner.undo();
		const effects = runner.redo();
		const replaced = effects.find((e) => e.type === 'documentReplaced');
		expect(replaced).toBeDefined();
		if (replaced && replaced.type === 'documentReplaced') {
			const i = (0 * replaced.document.width + 0) * 4;
			const layer = replaced.document.layer_pixels_at(0)!;
			expect(Array.from(layer.slice(i, i + 4))).toEqual([0, 0, 0, 255]);
		}
	});

	it('clear pushes snapshot, clears the canvas, and undo restores the pre-clear pixel', () => {
		const canvas = canvasFactory.create(8, 8);
		const { host, runner } = createRunner(canvas);

		runner.drawStart(0, 'mouse');
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();

		const effects = runner.clear();
		expect(hasEffect(effects, 'canvasChanged')).toBe(true);
		expect(getDocPixel(host.document, 0, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(runner.canUndo).toBe(true);

		const undoEffects = runner.undo();
		const replaced = undoEffects.find((e) => e.type === 'documentReplaced');
		expect(replaced?.type).toBe('documentReplaced');
		if (replaced?.type === 'documentReplaced') {
			const layer = replaced.document.layer_pixels_at(0)!;
			expect(Array.from(layer.slice(0, 4))).toEqual([0, 0, 0, 255]);
		}
	});

	it('pushSnapshot makes canUndo true', () => {
		const canvas = canvasFactory.create(8, 8);
		const { runner } = createRunner(canvas);

		expect(runner.canUndo).toBe(false);
		runner.pushSnapshot();
		expect(runner.canUndo).toBe(true);
	});
});

// ── documentReplaced effect ─────────────────────────────────────────

describe('ToolRunner — documentReplaced on undo with dimension change', () => {
	it('returns documentReplaced carrying the previous dimensions', () => {
		let currentCanvas = canvasFactory.create(8, 8);
		let currentDocument: Document = singleLayerDocument(
			currentCanvas.width,
			currentCanvas.height,
			currentCanvas.pixels()
		);
		const host: ToolRunnerHost = {
			get document() {
				return currentDocument;
			},
			get foregroundColor() {
				return BLACK;
			},
			get backgroundColor() {
				return WHITE;
			}
		};
		const shared = new SharedState();
		const samplingSession = createSamplingSession({ getSamplingPort: () => host.document });
		const runner = createToolRunner({ host, shared, getShiftHeld: () => false, samplingSession });

		runner.pushSnapshot();
		currentCanvas = canvasFactory.create(16, 16);
		currentDocument = singleLayerDocument(16, 16, currentCanvas.pixels());

		const effects = runner.undo();
		const replaced = effects.find((e) => e.type === 'documentReplaced');
		expect(replaced).toBeDefined();
		if (replaced && replaced.type === 'documentReplaced') {
			expect(replaced.document.width).toBe(8);
			expect(replaced.document.height).toBe(8);
		}
	});
});

// ── Guard behavior ──────────────────────────────────────────────────

describe('ToolRunner — guards', () => {
	it('draw returns empty when not drawing', () => {
		const { runner } = createRunner();
		const effects = runner.draw({ x: 0, y: 0 }, null);
		expect(effects).toEqual([]);
	});

	it('modifierChanged returns empty when not drawing', () => {
		const { runner } = createRunner();
		const effects = runner.modifierChanged();
		expect(effects).toEqual([]);
	});

	it('undo returns empty when drawing', () => {
		const { runner } = createRunner();
		runner.drawStart(0, 'mouse');
		runner.draw({ x: 0, y: 0 }, null);

		// Push a snapshot first so undo would normally succeed
		const effects = runner.undo();
		expect(effects).toEqual([]);

		runner.drawEnd();
	});

	it('redo returns empty when drawing', () => {
		const { runner } = createRunner();
		runner.drawStart(0, 'mouse');
		runner.draw({ x: 0, y: 0 }, null);

		const effects = runner.redo();
		expect(effects).toEqual([]);

		runner.drawEnd();
	});
});

// ── inputSource plumbing (live-sample lifecycle) ────────────────────

describe('ToolRunner — inputSource plumbing', () => {
	// Observed via the loupe's positioning preset (mouse uses an offset, touch
	// centers horizontally). Position is the only externally visible signal of
	// which input-source preset the session adopted.
	function loupePositionFor(pointerType: 'mouse' | 'pen' | 'touch') {
		const { runner, shared, samplingSession } = createRunner();
		shared.activeTool = 'eyedropper';
		runner.drawStart(0, pointerType);
		runner.draw({ x: 0, y: 0 }, null);
		samplingSession.updatePointer({
			screen: { x: 600, y: 400 },
			viewport: { width: 1200, height: 800 }
		});
		const position = samplingSession.position;
		runner.drawEnd();
		return position;
	}

	it('treats "mouse" and "pen" pointers as the same positioning preset', () => {
		expect(loupePositionFor('pen')).toEqual(loupePositionFor('mouse'));
	});

	it('treats "touch" pointers as a distinct positioning preset from mouse', () => {
		expect(loupePositionFor('touch')).not.toEqual(loupePositionFor('mouse'));
	});
});

// ── Shift constraint ────────────────────────────────────────────────

describe('ToolRunner — shift constraint', () => {
	it('propagates isShiftHeld to shape tool constraint', () => {
		const canvas = canvasFactory.create(8, 8);
		const host = createHost(canvas);
		const shared = new SharedState();
		shared.activeTool = 'line';
		let shiftHeld = false;
		const samplingSession = createSamplingSession({ getSamplingPort: () => host.document });
		const runner = createToolRunner({ host, shared, getShiftHeld: () => shiftHeld, samplingSession });

		shiftHeld = true;
		runner.drawStart(0, 'mouse');
		runner.draw({ x: 0, y: 0 }, null);
		runner.draw({ x: 5, y: 1 }, { x: 0, y: 0 });
		runner.drawEnd();

		// Constrained to horizontal: (0,0)→(5,0)
		expect(getDocPixel(host.document, 3, 0)).toEqual(BLACK);
		expect(getDocPixel(host.document, 0, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});

	it('responds to shift toggle mid-stroke via modifierChanged', () => {
		const host = createHost();
		const shared = new SharedState();
		shared.activeTool = 'line';
		let shiftHeld = false;
		const samplingSession = createSamplingSession({ getSamplingPort: () => host.document });
		const runner = createToolRunner({ host, shared, getShiftHeld: () => shiftHeld, samplingSession });

		runner.drawStart(0, 'mouse');
		runner.draw({ x: 0, y: 0 }, null);
		runner.draw({ x: 5, y: 1 }, { x: 0, y: 0 });

		// Without shift: line goes to (5,1)
		expect(getDocPixel(host.document, 5, 1)).toEqual(BLACK);

		// Toggle shift → constrain
		shiftHeld = true;
		const effects = runner.modifierChanged();
		expect(hasEffect(effects, 'canvasChanged')).toBe(true);

		// Now line should be horizontal
		expect(getDocPixel(host.document, 5, 0)).toEqual(BLACK);
		expect(getDocPixel(host.document, 5, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });

		runner.drawEnd();
	});
});
