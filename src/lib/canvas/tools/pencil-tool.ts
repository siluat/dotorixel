import {
	WasmToolType,
	apply_tool,
	wasm_interpolate_pixels
} from '$wasm/dotorixel_wasm';
import type { ContinuousTool, ToolContext } from '../draw-tool';
import type { CanvasCoords } from '../view-types';

function createFreehandTool(wasmTool: WasmToolType, addsActiveColor: boolean): ContinuousTool {
	return {
		kind: 'continuous',
		addsActiveColor,

		apply(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): boolean {
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

			return changed;
		}
	};
}

/** Freehand drawing tool that paints pixels with the active color. */
export const pencilTool: ContinuousTool = createFreehandTool(WasmToolType.Pencil, true);
/** Freehand tool that erases pixels to transparent. Does not add to recent colors. */
export const eraserTool: ContinuousTool = createFreehandTool(WasmToolType.Eraser, false);
