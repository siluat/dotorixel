import { describe, it, expect } from 'vitest';
import { WasmPixelCanvas, WasmColor, WasmToolType, apply_tool } from '$wasm/dotorixel_wasm';
import { floodfillTool } from './floodfill-tool';
import type { ToolContext } from '../draw-tool';
import type { Color } from '../color';

const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };

function createContext(overrides: Partial<ToolContext> = {}): ToolContext {
	return {
		canvas: overrides.canvas ?? new WasmPixelCanvas(8, 8),
		drawColor: overrides.drawColor ?? new WasmColor(255, 0, 0, 255),
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

describe('FloodfillTool', () => {
	it('fills a transparent area with the draw color', () => {
		const ctx = createContext();
		floodfillTool.onDrawStart(ctx);
		const result = floodfillTool.onDraw(ctx, { x: 0, y: 0 }, null);
		floodfillTool.onDrawEnd(ctx);

		expect(result.canvasChanged).toBe(true);
		expect(getPixel(ctx.canvas, 0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
		expect(getPixel(ctx.canvas, 7, 7)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
	});

	it('does not fill on subsequent draws (previous !== null)', () => {
		const ctx = createContext();
		floodfillTool.onDrawStart(ctx);
		floodfillTool.onDraw(ctx, { x: 0, y: 0 }, null);
		const result = floodfillTool.onDraw(ctx, { x: 1, y: 1 }, { x: 0, y: 0 });
		floodfillTool.onDrawEnd(ctx);

		expect(result.canvasChanged).toBe(false);
	});

	it('fills only the connected region', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		// Draw a vertical barrier at x=4
		const barrier = new WasmColor(0, 0, 0, 255);
		for (let y = 0; y < 8; y++) {
			apply_tool(canvas, 4, y, WasmToolType.Pencil, barrier);
		}

		const ctx = createContext({ canvas, drawColor: new WasmColor(255, 0, 0, 255) });
		floodfillTool.onDrawStart(ctx);
		floodfillTool.onDraw(ctx, { x: 0, y: 0 }, null);
		floodfillTool.onDrawEnd(ctx);

		// Left side filled
		expect(getPixel(canvas, 0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
		// Right side not filled (behind barrier)
		expect(getPixel(canvas, 5, 0).a).toBe(0);
	});

	it('returns addRecentColor on drawStart', () => {
		const ctx = createContext();
		const result = floodfillTool.onDrawStart(ctx);

		expect(result.addRecentColor).toBe('#000000');
	});

	it('capturesHistory is true', () => {
		expect(floodfillTool.capturesHistory).toBe(true);
	});
});
