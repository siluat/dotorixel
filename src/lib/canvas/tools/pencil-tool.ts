import {
	WasmToolType,
	apply_tool,
	wasm_interpolate_pixels
} from '$wasm/dotorixel_wasm';
import { colorToHex } from '../color';
import {
	CANVAS_CHANGED,
	NO_EFFECTS,
	type DrawTool,
	type ToolContext,
	type ToolEffects
} from '../draw-tool';
import type { CanvasCoords } from '../view-types';

function createFreehandTool(wasmTool: WasmToolType, addsRecentColor: boolean): DrawTool {
	return {
		capturesHistory: true,

		onDrawStart(ctx: ToolContext): ToolEffects {
			if (!addsRecentColor) return NO_EFFECTS;
			const isRightClick = ctx.drawButton === 2;
			const activeColor = isRightClick ? ctx.backgroundColor : ctx.foregroundColor;
			return [{ type: 'addRecentColor', hex: colorToHex(activeColor) }];
		},

		onDraw(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): ToolEffects {
			const { canvas, drawColor } = ctx;
			let changed = false;

			if (previous) {
				const flat = wasm_interpolate_pixels(previous.x, previous.y, current.x, current.y);
				for (let i = 0; i < flat.length; i += 2) {
					if (apply_tool(canvas, flat[i], flat[i + 1], wasmTool, drawColor)) {
						changed = true;
					}
				}
			} else {
				changed = apply_tool(canvas, current.x, current.y, wasmTool, drawColor);
			}

			return changed ? CANVAS_CHANGED : NO_EFFECTS;
		},

		onDrawEnd(): void {}
	};
}

/** Freehand drawing tool that paints pixels with the active color. */
export const pencilTool: DrawTool = createFreehandTool(WasmToolType.Pencil, true);
/** Freehand tool that erases pixels to transparent. Does not add to recent colors. */
export const eraserTool: DrawTool = createFreehandTool(WasmToolType.Eraser, false);
