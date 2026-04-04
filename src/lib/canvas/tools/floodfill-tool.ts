import { wasm_flood_fill } from '$wasm/dotorixel_wasm';
import { colorToHex } from '../color';
import { EMPTY_RESULT, type DrawTool, type DrawResult, type ToolContext } from '../draw-tool';
import type { CanvasCoords } from '../view-types';

export const floodfillTool: DrawTool = {
	capturesHistory: true,

	onDrawStart(ctx: ToolContext): DrawResult {
		const activeColor = ctx.drawButton === 2 ? ctx.backgroundColor : ctx.foregroundColor;
		return { canvasChanged: false, addRecentColor: colorToHex(activeColor) };
	},

	onDraw(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): DrawResult {
		if (previous !== null) return EMPTY_RESULT;
		return { canvasChanged: wasm_flood_fill(ctx.canvas, current.x, current.y, ctx.drawColor) };
	},

	onDrawEnd(): void {}
};
