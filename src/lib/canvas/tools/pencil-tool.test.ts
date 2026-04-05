import { describe, it, expect } from 'vitest';
import { WasmPixelCanvas, WasmColor } from '$wasm/dotorixel_wasm';
import { pencilTool, eraserTool } from './pencil-tool';
import type { ToolContext } from '../draw-tool';
import type { Color } from '../color';

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

describe('PencilTool', () => {
	it('draws a single pixel', () => {
		const ctx = createContext();
		pencilTool.onDrawStart(ctx);
		const result = pencilTool.onDraw(ctx, { x: 3, y: 3 }, null);
		pencilTool.onDrawEnd(ctx);

		expect(result.canvasChanged).toBe(true);
		expect(getPixel(ctx.canvas, 3, 3)).toEqual(BLACK);
	});

	it('interpolates between previous and current position', () => {
		const ctx = createContext();
		pencilTool.onDrawStart(ctx);
		pencilTool.onDraw(ctx, { x: 0, y: 0 }, null);
		pencilTool.onDraw(ctx, { x: 3, y: 0 }, { x: 0, y: 0 });
		pencilTool.onDrawEnd(ctx);

		for (let x = 0; x <= 3; x++) {
			expect(getPixel(ctx.canvas, x, 0)).toEqual(BLACK);
		}
	});

	it('draws with the provided drawColor', () => {
		const red = new WasmColor(255, 0, 0, 255);
		const ctx = createContext({ drawColor: red });
		pencilTool.onDrawStart(ctx);
		pencilTool.onDraw(ctx, { x: 2, y: 2 }, null);
		pencilTool.onDrawEnd(ctx);

		expect(getPixel(ctx.canvas, 2, 2)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
	});

	it('returns addRecentColor on drawStart', () => {
		const ctx = createContext();
		const result = pencilTool.onDrawStart(ctx);

		expect(result.addRecentColor).toBe('#000000');
	});

	it('returns background color hex on right-click drawStart', () => {
		const ctx = createContext({ drawButton: 2 });
		const result = pencilTool.onDrawStart(ctx);

		expect(result.addRecentColor).toBe('#ffffff');
	});

	it('capturesHistory is true', () => {
		expect(pencilTool.capturesHistory).toBe(true);
	});
});

describe('EraserTool', () => {
	it('erases a pixel to transparent', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		// Paint a pixel first using pencil
		const paintCtx = createContext({ canvas, drawColor: new WasmColor(0, 0, 0, 255) });
		pencilTool.onDraw(paintCtx, { x: 3, y: 3 }, null);
		expect(getPixel(canvas, 3, 3)).toEqual(BLACK);

		// Erase it
		const eraseCtx = createContext({ canvas, drawColor: new WasmColor(0, 0, 0, 255) });
		eraserTool.onDrawStart(eraseCtx);
		eraserTool.onDraw(eraseCtx, { x: 3, y: 3 }, null);
		eraserTool.onDrawEnd(eraseCtx);

		expect(getPixel(canvas, 3, 3)).toEqual(TRANSPARENT);
	});

	it('does not return addRecentColor on drawStart', () => {
		const ctx = createContext();
		const result = eraserTool.onDrawStart(ctx);

		expect(result.addRecentColor).toBeUndefined();
	});

	it('capturesHistory is true', () => {
		expect(eraserTool.capturesHistory).toBe(true);
	});
});
