import { describe, it, expect } from 'vitest';
import { WasmPixelCanvas, WasmColor, WasmToolType, apply_tool } from '$wasm/dotorixel_wasm';
import { eyedropperTool } from './eyedropper-tool';
import type { ToolContext } from '../draw-tool';
import type { Color } from '../color';

const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };

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

function paintPixel(canvas: WasmPixelCanvas, x: number, y: number, color: WasmColor): void {
	apply_tool(canvas, x, y, WasmToolType.Pencil, color);
}

describe('EyedropperTool', () => {
	it('picks the color of a painted pixel', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		paintPixel(canvas, 3, 3, new WasmColor(255, 0, 0, 255));

		const ctx = createContext({ canvas });
		eyedropperTool.onDrawStart(ctx);
		const result = eyedropperTool.onDraw(ctx, { x: 3, y: 3 }, null);
		eyedropperTool.onDrawEnd(ctx);

		expect(result.colorPick).toEqual({
			target: 'foreground',
			color: { r: 255, g: 0, b: 0, a: 255 }
		});
	});

	it('returns no colorPick for transparent pixels', () => {
		const ctx = createContext();
		eyedropperTool.onDrawStart(ctx);
		const result = eyedropperTool.onDraw(ctx, { x: 0, y: 0 }, null);
		eyedropperTool.onDrawEnd(ctx);

		expect(result.colorPick).toBeUndefined();
	});

	it('targets background slot on right-click', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		paintPixel(canvas, 2, 2, new WasmColor(0, 128, 0, 255));

		const ctx = createContext({ canvas, drawButton: 2 });
		eyedropperTool.onDrawStart(ctx);
		const result = eyedropperTool.onDraw(ctx, { x: 2, y: 2 }, null);
		eyedropperTool.onDrawEnd(ctx);

		expect(result.colorPick?.target).toBe('background');
	});

	it('returns addRecentColor with hex of picked color', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		paintPixel(canvas, 1, 1, new WasmColor(0, 128, 0, 255));

		const ctx = createContext({ canvas });
		eyedropperTool.onDrawStart(ctx);
		const result = eyedropperTool.onDraw(ctx, { x: 1, y: 1 }, null);
		eyedropperTool.onDrawEnd(ctx);

		expect(result.addRecentColor).toBe('#008000');
	});

	it('ignores subsequent draws (previous !== null)', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		paintPixel(canvas, 0, 0, new WasmColor(255, 0, 0, 255));

		const ctx = createContext({ canvas });
		eyedropperTool.onDrawStart(ctx);
		eyedropperTool.onDraw(ctx, { x: 0, y: 0 }, null);
		const result = eyedropperTool.onDraw(ctx, { x: 0, y: 0 }, { x: 0, y: 0 });
		eyedropperTool.onDrawEnd(ctx);

		expect(result.colorPick).toBeUndefined();
	});

	it('does not return addRecentColor on drawStart', () => {
		const ctx = createContext();
		const result = eyedropperTool.onDrawStart(ctx);

		expect(result.addRecentColor).toBeUndefined();
	});

	it('capturesHistory is false', () => {
		expect(eyedropperTool.capturesHistory).toBe(false);
	});

	it('canvasChanged is always false', () => {
		const canvas = new WasmPixelCanvas(8, 8);
		paintPixel(canvas, 0, 0, new WasmColor(255, 0, 0, 255));

		const ctx = createContext({ canvas });
		eyedropperTool.onDrawStart(ctx);
		const result = eyedropperTool.onDraw(ctx, { x: 0, y: 0 }, null);
		eyedropperTool.onDrawEnd(ctx);

		expect(result.canvasChanged).toBe(false);
	});
});
