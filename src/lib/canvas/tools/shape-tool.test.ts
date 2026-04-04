import { describe, it, expect } from 'vitest';
import {
	WasmPixelCanvas,
	WasmColor,
	WasmToolType,
	wasm_interpolate_pixels,
	wasm_rectangle_outline,
	wasm_ellipse_outline
} from '$wasm/dotorixel_wasm';
import { createShapeTool } from './shape-tool';
import { constrainLine, constrainSquare } from '../constrain';
import type { ToolContext } from '../draw-tool';
import type { Color } from '../color';

const BLACK_COLOR: Color = { r: 0, g: 0, b: 0, a: 255 };
const WHITE_COLOR: Color = { r: 255, g: 255, b: 255, a: 255 };
const BLACK = { r: 0, g: 0, b: 0, a: 255 };
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

let shiftHeld = false;

function createContext(overrides: Partial<ToolContext> = {}): ToolContext {
	return {
		canvas: overrides.canvas ?? new WasmPixelCanvas(8, 8),
		drawColor: overrides.drawColor ?? new WasmColor(0, 0, 0, 255),
		drawButton: overrides.drawButton ?? 0,
		isShiftHeld: overrides.isShiftHeld ?? (() => shiftHeld),
		foregroundColor: overrides.foregroundColor ?? BLACK_COLOR,
		backgroundColor: overrides.backgroundColor ?? WHITE_COLOR,
	};
}

function getPixel(canvas: WasmPixelCanvas, x: number, y: number) {
	const p = canvas.get_pixel(x, y);
	return { r: p.r, g: p.g, b: p.b, a: p.a };
}

describe('ShapeTool — line', () => {
	const createLineTool = () =>
		createShapeTool(WasmToolType.Line, wasm_interpolate_pixels, constrainLine);

	it('draws a horizontal line from start to end', () => {
		const tool = createLineTool();
		const ctx = createContext();
		tool.onDrawStart(ctx);
		tool.onDraw(ctx, { x: 0, y: 0 }, null);
		tool.onDraw(ctx, { x: 3, y: 0 }, { x: 0, y: 0 });
		tool.onDrawEnd(ctx);

		for (let x = 0; x <= 3; x++) {
			expect(getPixel(ctx.canvas, x, 0)).toEqual(BLACK);
		}
	});

	it('does not leave intermediate preview artifacts', () => {
		const tool = createLineTool();
		const ctx = createContext();
		tool.onDrawStart(ctx);
		tool.onDraw(ctx, { x: 0, y: 0 }, null);

		// Drag to intermediate point — diagonal
		tool.onDraw(ctx, { x: 4, y: 4 }, { x: 0, y: 0 });
		expect(getPixel(ctx.canvas, 2, 2)).toEqual(BLACK);

		// Move to final position — horizontal
		tool.onDraw(ctx, { x: 3, y: 0 }, { x: 4, y: 4 });
		expect(getPixel(ctx.canvas, 2, 2)).toEqual(TRANSPARENT);
		expect(getPixel(ctx.canvas, 2, 0)).toEqual(BLACK);

		tool.onDrawEnd(ctx);
	});

	it('constrains to horizontal when shift is held', () => {
		shiftHeld = true;
		const tool = createLineTool();
		const ctx = createContext();
		tool.onDrawStart(ctx);
		tool.onDraw(ctx, { x: 0, y: 0 }, null);
		tool.onDraw(ctx, { x: 5, y: 1 }, { x: 0, y: 0 });
		tool.onDrawEnd(ctx);
		shiftHeld = false;

		expect(getPixel(ctx.canvas, 3, 0)).toEqual(BLACK);
		expect(getPixel(ctx.canvas, 0, 1)).toEqual(TRANSPARENT);
	});

	it('returns addRecentColor on drawStart', () => {
		const tool = createLineTool();
		const ctx = createContext();
		const result = tool.onDrawStart(ctx);

		expect(result.addRecentColor).toBe('#000000');
	});
});

describe('ShapeTool — rectangle', () => {
	const createRectTool = () =>
		createShapeTool(WasmToolType.Rectangle, wasm_rectangle_outline, constrainSquare);

	it('draws a rectangle outline', () => {
		const tool = createRectTool();
		const ctx = createContext();
		tool.onDrawStart(ctx);
		tool.onDraw(ctx, { x: 1, y: 1 }, null);
		tool.onDraw(ctx, { x: 3, y: 3 }, { x: 1, y: 1 });
		tool.onDrawEnd(ctx);

		// Outline pixels
		expect(getPixel(ctx.canvas, 1, 1)).toEqual(BLACK);
		expect(getPixel(ctx.canvas, 2, 1)).toEqual(BLACK);
		expect(getPixel(ctx.canvas, 3, 1)).toEqual(BLACK);
		expect(getPixel(ctx.canvas, 3, 3)).toEqual(BLACK);
		// Interior
		expect(getPixel(ctx.canvas, 2, 2)).toEqual(TRANSPARENT);
	});
});

describe('ShapeTool — ellipse', () => {
	const createEllipseTool = () =>
		createShapeTool(WasmToolType.Ellipse, wasm_ellipse_outline, constrainSquare);

	it('draws an ellipse outline', () => {
		const tool = createEllipseTool();
		const ctx = createContext();
		tool.onDrawStart(ctx);
		tool.onDraw(ctx, { x: 1, y: 1 }, null);
		tool.onDraw(ctx, { x: 5, y: 5 }, { x: 1, y: 1 });
		tool.onDrawEnd(ctx);

		expect(getPixel(ctx.canvas, 3, 1)).toEqual(BLACK); // top
		expect(getPixel(ctx.canvas, 3, 5)).toEqual(BLACK); // bottom
		expect(getPixel(ctx.canvas, 1, 3)).toEqual(BLACK); // left
		expect(getPixel(ctx.canvas, 5, 3)).toEqual(BLACK); // right
	});
});

describe('ShapeTool — onModifierChange', () => {
	const createLineTool = () =>
		createShapeTool(WasmToolType.Line, wasm_interpolate_pixels, constrainLine);

	it('redraws with constraint when shift is toggled mid-stroke', () => {
		const tool = createLineTool();
		const ctx = createContext();
		tool.onDrawStart(ctx);
		tool.onDraw(ctx, { x: 0, y: 0 }, null);
		tool.onDraw(ctx, { x: 5, y: 1 }, { x: 0, y: 0 });

		// Without shift: line goes to (5,1)
		expect(getPixel(ctx.canvas, 5, 1)).toEqual(BLACK);

		// Toggle shift on → constrain to horizontal
		shiftHeld = true;
		const result = tool.onModifierChange!(ctx, { x: 5, y: 1 });
		shiftHeld = false;

		expect(result.canvasChanged).toBe(true);
		expect(getPixel(ctx.canvas, 5, 0)).toEqual(BLACK);
		expect(getPixel(ctx.canvas, 5, 1)).toEqual(TRANSPARENT);

		tool.onDrawEnd(ctx);
	});
});
