import { type WasmToolType, apply_tool } from '$wasm/dotorixel_wasm';
import { colorToHex } from '../color';
import {
	CANVAS_CHANGED,
	NO_EFFECTS,
	type DrawTool,
	type ToolContext,
	type ToolEffects
} from '../draw-tool';
import type { CanvasCoords } from '../view-types';

type ShapePixelsFn = (x0: number, y0: number, x1: number, y1: number) => Int32Array;
type ConstrainFn = (start: CanvasCoords, end: CanvasCoords) => CanvasCoords;

/**
 * Creates a shape tool with snapshot-restore live preview.
 * Restores the canvas to its pre-stroke state before each preview redraw,
 * and supports shift-constrained drawing via `onModifierChange`.
 */
export function createShapeTool(
	wasmTool: WasmToolType,
	generatePixels: ShapePixelsFn,
	constrainFn: ConstrainFn
): DrawTool {
	let shapeStart: CanvasCoords | null = null;
	let previewSnapshot: Uint8Array | null = null;

	function drawShape(ctx: ToolContext, current: CanvasCoords): ToolEffects {
		if (!shapeStart || !previewSnapshot) return NO_EFFECTS;

		const end = ctx.isShiftHeld() ? constrainFn(shapeStart, current) : current;
		ctx.canvas.restore_pixels(previewSnapshot);

		const flat = generatePixels(shapeStart.x, shapeStart.y, end.x, end.y);
		for (let i = 0; i < flat.length; i += 2) {
			apply_tool(ctx.canvas, flat[i], flat[i + 1], wasmTool, ctx.drawColor);
		}
		return CANVAS_CHANGED;
	}

	return {
		capturesHistory: true,

		onDrawStart(ctx: ToolContext): ToolEffects {
			previewSnapshot = new Uint8Array(ctx.canvas.pixels());
			shapeStart = null;
			const isRightClick = ctx.drawButton === 2;
			const activeColor = isRightClick ? ctx.backgroundColor : ctx.foregroundColor;
			return [{ type: 'addRecentColor', hex: colorToHex(activeColor) }];
		},

		onDraw(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): ToolEffects {
			if (previous === null) {
				shapeStart = current;
				const changed = apply_tool(ctx.canvas, current.x, current.y, wasmTool, ctx.drawColor);
				return changed ? CANVAS_CHANGED : NO_EFFECTS;
			}

			return drawShape(ctx, current);
		},

		onDrawEnd(): void {
			shapeStart = null;
			previewSnapshot = null;
		},

		onModifierChange(ctx: ToolContext, current: CanvasCoords): ToolEffects {
			return drawShape(ctx, current);
		}
	};
}
