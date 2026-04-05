import { type WasmToolType, apply_tool } from '$wasm/dotorixel_wasm';
import { colorToHex } from '../color';
import { EMPTY_RESULT, type DrawTool, type DrawResult, type ToolContext } from '../draw-tool';
import type { CanvasCoords } from '../view-types';

type ShapePixelsFn = (x0: number, y0: number, x1: number, y1: number) => Int32Array;
type ConstrainFn = (start: CanvasCoords, end: CanvasCoords) => CanvasCoords;

export function createShapeTool(
	wasmTool: WasmToolType,
	generatePixels: ShapePixelsFn,
	constrainFn: ConstrainFn
): DrawTool {
	let shapeStart: CanvasCoords | null = null;
	let previewSnapshot: Uint8Array | null = null;
	let lastCurrent: CanvasCoords | null = null;

	function drawShape(ctx: ToolContext, current: CanvasCoords): DrawResult {
		if (!shapeStart || !previewSnapshot) return EMPTY_RESULT;

		const end = ctx.isShiftHeld() ? constrainFn(shapeStart, current) : current;
		ctx.canvas.restore_pixels(previewSnapshot);

		const flat = generatePixels(shapeStart.x, shapeStart.y, end.x, end.y);
		for (let i = 0; i < flat.length; i += 2) {
			apply_tool(ctx.canvas, flat[i], flat[i + 1], wasmTool, ctx.drawColor);
		}
		return { canvasChanged: true };
	}

	return {
		capturesHistory: true,

		onDrawStart(ctx: ToolContext): DrawResult {
			previewSnapshot = new Uint8Array(ctx.canvas.pixels());
			shapeStart = null;
			lastCurrent = null;
			const isRightClick = ctx.drawButton === 2;
			const activeColor = isRightClick ? ctx.backgroundColor : ctx.foregroundColor;
			return { canvasChanged: false, addRecentColor: colorToHex(activeColor) };
		},

		onDraw(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): DrawResult {
			lastCurrent = current;

			if (previous === null) {
				shapeStart = current;
				const changed = apply_tool(ctx.canvas, current.x, current.y, wasmTool, ctx.drawColor);
				return { canvasChanged: changed };
			}

			return drawShape(ctx, current);
		},

		onDrawEnd(): void {
			shapeStart = null;
			previewSnapshot = null;
			lastCurrent = null;
		},

		onModifierChange(ctx: ToolContext, current: CanvasCoords): DrawResult {
			lastCurrent = current;
			return drawShape(ctx, current);
		}
	};
}
