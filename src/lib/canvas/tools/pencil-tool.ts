import {
	WasmToolType,
	apply_tool,
	wasm_interpolate_pixels
} from '$wasm/dotorixel_wasm';
import { colorToHex } from '../color';
import { EMPTY_RESULT, type DrawTool, type DrawResult, type ToolContext } from '../draw-tool';
import type { CanvasCoords } from '../view-types';

function createFreehandTool(wasmTool: WasmToolType, addsRecentColor: boolean): DrawTool {
	return {
		capturesHistory: true,

		onDrawStart(ctx: ToolContext): DrawResult {
			if (!addsRecentColor) return EMPTY_RESULT;
			const activeColor = ctx.drawButton === 2 ? ctx.backgroundColor : ctx.foregroundColor;
			return { canvasChanged: false, addRecentColor: colorToHex(activeColor) };
		},

		onDraw(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): DrawResult {
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

			return { canvasChanged: changed };
		},

		onDrawEnd(): void {}
	};
}

export const pencilTool: DrawTool = createFreehandTool(WasmToolType.Pencil, true);
export const eraserTool: DrawTool = createFreehandTool(WasmToolType.Eraser, false);
