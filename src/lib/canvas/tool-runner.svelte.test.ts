// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { WasmPixelCanvas, WasmColor } from '$wasm/dotorixel_wasm';
import { createToolRunner, type ToolRunnerHost, type ToolEffects } from './tool-runner.svelte';
import { SharedState } from './shared-state.svelte';
import type { Color } from './color';

const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };
const RED: Color = { r: 255, g: 0, b: 0, a: 255 };

function createHost(canvas?: WasmPixelCanvas, fg?: Color, bg?: Color): ToolRunnerHost {
	const pixelCanvas = canvas ?? new WasmPixelCanvas(8, 8);
	let foregroundColor = fg ?? BLACK;
	let backgroundColor = bg ?? WHITE;
	return {
		get pixelCanvas() {
			return pixelCanvas;
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

function createRunner(canvas?: WasmPixelCanvas, fg?: Color, bg?: Color) {
	const host = createHost(canvas, fg, bg);
	const shared = new SharedState();
	const runner = createToolRunner(host, shared);
	runner.connectModifiers({ isShiftHeld: () => false });
	return { host, shared, runner };
}

function getPixel(canvas: WasmPixelCanvas, x: number, y: number) {
	const p = canvas.get_pixel(x, y);
	return { r: p.r, g: p.g, b: p.b, a: p.a };
}

function hasEffect(effects: ToolEffects, type: string): boolean {
	return effects.some((e) => e.type === type);
}

// ── Draw lifecycle effects ──────────────────────────────────────────

describe('ToolRunner — pencil tool', () => {
	it('produces canvasChanged and addRecentColor effects', () => {
		const { runner } = createRunner();
		const startEffects = runner.drawStart(0);
		expect(hasEffect(startEffects, 'addRecentColor')).toBe(true);

		const drawEffects = runner.draw({ x: 3, y: 3 }, null);
		expect(hasEffect(drawEffects, 'canvasChanged')).toBe(true);

		runner.drawEnd();
	});

	it('draws a pixel on the canvas', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const { runner } = createRunner(canvas);
		runner.drawStart(0);
		runner.draw({ x: 3, y: 3 }, null);
		runner.drawEnd();

		expect(getPixel(canvas, 3, 3)).toEqual(BLACK);
	});
});

describe('ToolRunner — eyedropper tool', () => {
	it('produces colorPick effect, no canvasChanged', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		// Paint a red pixel first
		const { runner, shared } = createRunner(canvas);
		shared.activeTool = 'pencil';
		const host = { pixelCanvas: canvas, foregroundColor: RED, backgroundColor: WHITE } as ToolRunnerHost;
		// Use a separate runner with red foreground
		const shared2 = new SharedState();
		const runner2 = createToolRunner(host, shared2);
		runner2.connectModifiers({ isShiftHeld: () => false });
		runner2.drawStart(0);
		runner2.draw({ x: 2, y: 2 }, null);
		runner2.drawEnd();
		expect(getPixel(canvas, 2, 2)).toEqual(RED);

		// Now use eyedropper
		shared.activeTool = 'eyedropper';
		runner.drawStart(0);
		const effects = runner.draw({ x: 2, y: 2 }, null);
		runner.drawEnd();

		expect(hasEffect(effects, 'colorPick')).toBe(true);
		expect(hasEffect(effects, 'canvasChanged')).toBe(false);
		const colorPickEffect = effects.find((e) => e.type === 'colorPick');
		expect(colorPickEffect).toEqual({ type: 'colorPick', target: 'foreground', color: RED });
	});

	it('does not push a history snapshot', () => {
		const { runner, shared } = createRunner();
		shared.activeTool = 'eyedropper';
		runner.drawStart(0);
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();

		expect(runner.canUndo).toBe(false);
	});
});

describe('ToolRunner — floodfill tool', () => {
	it('fills on first draw, ignores subsequent drags', () => {
		const canvas = new WasmPixelCanvas(4, 4);
		const { runner, shared } = createRunner(canvas);
		shared.activeTool = 'floodfill';

		runner.drawStart(0);
		const firstDraw = runner.draw({ x: 0, y: 0 }, null);
		expect(hasEffect(firstDraw, 'canvasChanged')).toBe(true);

		const secondDraw = runner.draw({ x: 1, y: 1 }, { x: 0, y: 0 });
		expect(hasEffect(secondDraw, 'canvasChanged')).toBe(false);

		runner.drawEnd();
	});
});

describe('ToolRunner — shape tool', () => {
	it('draws a line and produces correct effects', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const { runner, shared } = createRunner(canvas);
		shared.activeTool = 'line';

		runner.drawStart(0);
		runner.draw({ x: 0, y: 0 }, null);
		const drawEffects = runner.draw({ x: 3, y: 0 }, { x: 0, y: 0 });
		expect(hasEffect(drawEffects, 'canvasChanged')).toBe(true);
		runner.drawEnd();

		for (let x = 0; x <= 3; x++) {
			expect(getPixel(canvas, x, 0)).toEqual(BLACK);
		}
	});

	it('cleans up preview artifacts on drawEnd', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const { runner, shared } = createRunner(canvas);
		shared.activeTool = 'line';

		runner.drawStart(0);
		runner.draw({ x: 0, y: 0 }, null);
		runner.draw({ x: 4, y: 4 }, { x: 0, y: 0 });
		// Intermediate preview drawn
		expect(getPixel(canvas, 2, 2)).toEqual(BLACK);

		// Change to final position
		runner.draw({ x: 3, y: 0 }, { x: 4, y: 4 });
		// Intermediate preview cleaned
		expect(getPixel(canvas, 2, 2)).toEqual({ r: 0, g: 0, b: 0, a: 0 });

		runner.drawEnd();
	});
});

describe('ToolRunner — move tool', () => {
	it('shifts canvas content and produces canvasChanged', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const { runner, shared } = createRunner(canvas);

		// Paint a pixel with pencil
		shared.activeTool = 'pencil';
		runner.drawStart(0);
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();
		expect(getPixel(canvas, 0, 0)).toEqual(BLACK);

		// Move it
		shared.activeTool = 'move';
		runner.drawStart(0);
		runner.draw({ x: 0, y: 0 }, null);
		const moveEffects = runner.draw({ x: 2, y: 3 }, { x: 0, y: 0 });
		expect(hasEffect(moveEffects, 'canvasChanged')).toBe(true);
		runner.drawEnd();

		expect(getPixel(canvas, 2, 3)).toEqual(BLACK);
		expect(getPixel(canvas, 0, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});
});

// ── Right-click uses background color ───────────────────────────────

describe('ToolRunner — right-click', () => {
	it('uses background color for pencil on right-click', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const { runner } = createRunner(canvas);

		runner.drawStart(2);
		runner.draw({ x: 3, y: 3 }, null);
		runner.drawEnd();

		expect(getPixel(canvas, 3, 3)).toEqual(WHITE);
	});
});

// ── History behavior ────────────────────────────────────────────────

describe('ToolRunner — history', () => {
	it('pushes snapshot for capturesHistory tools', () => {
		const { runner } = createRunner();
		runner.drawStart(0);
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();

		expect(runner.canUndo).toBe(true);
	});

	it('undo returns canvasChanged effect', () => {
		const { runner } = createRunner();
		runner.drawStart(0);
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();

		const effects = runner.undo();
		expect(hasEffect(effects, 'canvasChanged')).toBe(true);
	});

	it('redo returns canvasChanged effect', () => {
		const { runner } = createRunner();
		runner.drawStart(0);
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();

		runner.undo();
		const effects = runner.redo();
		expect(hasEffect(effects, 'canvasChanged')).toBe(true);
	});

	it('undo restores previous canvas state', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const { runner } = createRunner(canvas);

		runner.drawStart(0);
		runner.draw({ x: 3, y: 3 }, null);
		runner.drawEnd();
		expect(getPixel(canvas, 3, 3)).toEqual(BLACK);

		runner.undo();
		expect(getPixel(canvas, 3, 3)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});

	it('clear pushes snapshot and returns canvasChanged', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const { runner } = createRunner(canvas);

		runner.drawStart(0);
		runner.draw({ x: 0, y: 0 }, null);
		runner.drawEnd();

		const effects = runner.clear();
		expect(hasEffect(effects, 'canvasChanged')).toBe(true);
		expect(getPixel(canvas, 0, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });

		// Can undo the clear
		runner.undo();
		expect(getPixel(canvas, 0, 0)).toEqual(BLACK);
	});

	it('pushSnapshot makes canUndo true', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const { runner } = createRunner(canvas);

		expect(runner.canUndo).toBe(false);
		runner.pushSnapshot();
		expect(runner.canUndo).toBe(true);
	});
});

// ── canvasReplaced effect ───────────────────────────────────────────

describe('ToolRunner — canvasReplaced', () => {
	it('returns canvasReplaced on undo when dimensions changed', () => {
		let currentCanvas = new WasmPixelCanvas(8, 8);
		const host: ToolRunnerHost = {
			get pixelCanvas() {
				return currentCanvas;
			},
			get foregroundColor() {
				return BLACK;
			},
			get backgroundColor() {
				return WHITE;
			}
		};
		const shared = new SharedState();
		const runner = createToolRunner(host, shared);
		runner.connectModifiers({ isShiftHeld: () => false });

		// Push snapshot of 8x8, then simulate resize by swapping the canvas
		runner.pushSnapshot();
		currentCanvas = new WasmPixelCanvas(16, 16);

		const effects = runner.undo();
		const replaced = effects.find((e) => e.type === 'canvasReplaced');
		expect(replaced).toBeDefined();
		if (replaced && replaced.type === 'canvasReplaced') {
			expect(replaced.canvas.width).toBe(8);
			expect(replaced.canvas.height).toBe(8);
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
		runner.drawStart(0);
		runner.draw({ x: 0, y: 0 }, null);

		// Push a snapshot first so undo would normally succeed
		const effects = runner.undo();
		expect(effects).toEqual([]);

		runner.drawEnd();
	});

	it('redo returns empty when drawing', () => {
		const { runner } = createRunner();
		runner.drawStart(0);
		runner.draw({ x: 0, y: 0 }, null);

		const effects = runner.redo();
		expect(effects).toEqual([]);

		runner.drawEnd();
	});
});

// ── connectModifiers ────────────────────────────────────────────────

describe('ToolRunner — connectModifiers', () => {
	it('propagates isShiftHeld to shape tool constraint', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const host = createHost(canvas);
		const shared = new SharedState();
		shared.activeTool = 'line';
		const runner = createToolRunner(host, shared);
		let shiftHeld = false;
		runner.connectModifiers({ isShiftHeld: () => shiftHeld });

		shiftHeld = true;
		runner.drawStart(0);
		runner.draw({ x: 0, y: 0 }, null);
		runner.draw({ x: 5, y: 1 }, { x: 0, y: 0 });
		runner.drawEnd();

		// Constrained to horizontal: (0,0)→(5,0)
		expect(getPixel(canvas, 3, 0)).toEqual(BLACK);
		expect(getPixel(canvas, 0, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});

	it('responds to shift toggle mid-stroke via modifierChanged', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		const host = createHost(canvas);
		const shared = new SharedState();
		shared.activeTool = 'line';
		const runner = createToolRunner(host, shared);
		let shiftHeld = false;
		runner.connectModifiers({ isShiftHeld: () => shiftHeld });

		runner.drawStart(0);
		runner.draw({ x: 0, y: 0 }, null);
		runner.draw({ x: 5, y: 1 }, { x: 0, y: 0 });

		// Without shift: line goes to (5,1)
		expect(getPixel(canvas, 5, 1)).toEqual(BLACK);

		// Toggle shift → constrain
		shiftHeld = true;
		const effects = runner.modifierChanged();
		expect(hasEffect(effects, 'canvasChanged')).toBe(true);

		// Now line should be horizontal
		expect(getPixel(canvas, 5, 0)).toEqual(BLACK);
		expect(getPixel(canvas, 5, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });

		runner.drawEnd();
	});
});
