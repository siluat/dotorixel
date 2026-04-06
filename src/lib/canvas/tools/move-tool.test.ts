import { describe, it, expect } from 'vitest';
import { WasmPixelCanvas, WasmColor, WasmToolType, apply_tool } from '$wasm/dotorixel_wasm';
import { createMoveTool } from './move-tool';
import type { ToolContext, ToolEffects } from '../draw-tool';
import type { Color } from '../color';

function hasEffect(effects: ToolEffects, type: string): boolean {
	return effects.some((e) => e.type === type);
}

const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

function createContext(overrides: Partial<ToolContext> = {}): ToolContext {
	return {
		canvas: overrides.canvas ?? new WasmPixelCanvas(8, 8),
		drawColor: overrides.drawColor ?? new WasmColor(0, 0, 0, 255),
		drawButton: overrides.drawButton ?? 0,
		isShiftHeld: overrides.isShiftHeld ?? (() => false),
		foregroundColor: overrides.foregroundColor ?? BLACK,
		backgroundColor: overrides.backgroundColor ?? WHITE,
	};
}

function getPixel(canvas: WasmPixelCanvas, x: number, y: number) {
	const p = canvas.get_pixel(x, y);
	return { r: p.r, g: p.g, b: p.b, a: p.a };
}

function paintPixel(canvas: WasmPixelCanvas, x: number, y: number): void {
	apply_tool(canvas, x, y, WasmToolType.Pencil, new WasmColor(0, 0, 0, 255));
}

describe('MoveTool', () => {
	it('shifts canvas content to new position', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		paintPixel(canvas, 0, 0);

		const tool = createMoveTool();
		const ctx = createContext({ canvas });
		tool.onDrawStart(ctx);
		tool.onDraw(ctx, { x: 0, y: 0 }, null);
		tool.onDraw(ctx, { x: 2, y: 3 }, { x: 0, y: 0 });
		tool.onDrawEnd(ctx);

		expect(getPixel(canvas, 2, 3)).toEqual(BLACK);
		expect(getPixel(canvas, 0, 0)).toEqual(TRANSPARENT);
	});

	it('clips pixels shifted off canvas', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		paintPixel(canvas, 7, 7);

		const tool = createMoveTool();
		const ctx = createContext({ canvas });
		tool.onDrawStart(ctx);
		tool.onDraw(ctx, { x: 0, y: 0 }, null);
		tool.onDraw(ctx, { x: 1, y: 0 }, { x: 0, y: 0 });
		tool.onDrawEnd(ctx);

		expect(getPixel(canvas, 7, 7)).toEqual(TRANSPARENT);
	});

	it('returns no canvasChanged on first draw (sets start)', () => {
		const tool = createMoveTool();
		const ctx = createContext();
		tool.onDrawStart(ctx);
		const effects = tool.onDraw(ctx, { x: 3, y: 3 }, null);

		expect(hasEffect(effects, 'canvasChanged')).toBe(false);
		tool.onDrawEnd(ctx);
	});

	it('returns canvasChanged on subsequent draws', () => {
		const tool = createMoveTool();
		const ctx = createContext();
		tool.onDrawStart(ctx);
		tool.onDraw(ctx, { x: 0, y: 0 }, null);
		const effects = tool.onDraw(ctx, { x: 1, y: 1 }, { x: 0, y: 0 });
		tool.onDrawEnd(ctx);

		expect(hasEffect(effects, 'canvasChanged')).toBe(true);
	});

	it('does not return addRecentColor', () => {
		const tool = createMoveTool();
		const ctx = createContext();
		const effects = tool.onDrawStart(ctx);

		expect(hasEffect(effects, 'addRecentColor')).toBe(false);
		tool.onDrawEnd(ctx);
	});

	it('zero-delta move leaves pixels unchanged', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		paintPixel(canvas, 3, 3);

		const tool = createMoveTool();
		const ctx = createContext({ canvas });
		tool.onDrawStart(ctx);
		tool.onDraw(ctx, { x: 3, y: 3 }, null);
		tool.onDraw(ctx, { x: 3, y: 3 }, { x: 3, y: 3 });
		tool.onDrawEnd(ctx);

		expect(getPixel(canvas, 3, 3)).toEqual(BLACK);
	});

	it('capturesHistory is true', () => {
		const tool = createMoveTool();
		expect(tool.capturesHistory).toBe(true);
	});

	it('cleans up state on drawEnd', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		paintPixel(canvas, 0, 0);

		const tool = createMoveTool();
		const ctx = createContext({ canvas });

		// First stroke
		tool.onDrawStart(ctx);
		tool.onDraw(ctx, { x: 0, y: 0 }, null);
		tool.onDraw(ctx, { x: 1, y: 0 }, { x: 0, y: 0 });
		tool.onDrawEnd(ctx);

		// Second stroke should work independently
		tool.onDrawStart(ctx);
		tool.onDraw(ctx, { x: 1, y: 0 }, null);
		tool.onDraw(ctx, { x: 2, y: 0 }, { x: 1, y: 0 });
		tool.onDrawEnd(ctx);

		expect(getPixel(canvas, 2, 0)).toEqual(BLACK);
	});
});
