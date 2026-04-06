import { wasm_flood_fill } from '$wasm/dotorixel_wasm';
import { colorToHex } from '../color';
import {
	CANVAS_CHANGED,
	NO_EFFECTS,
	type DrawTool,
	type ToolContext,
	type ToolEffects
} from '../draw-tool';
import type { CanvasCoords } from '../view-types';

/** Fills connected same-color pixels on initial click. Ignores drag events. */
export const floodfillTool: DrawTool = {
	capturesHistory: true,

	onDrawStart(ctx: ToolContext): ToolEffects {
		const isRightClick = ctx.drawButton === 2;
		const activeColor = isRightClick ? ctx.backgroundColor : ctx.foregroundColor;
		return [{ type: 'addRecentColor', hex: colorToHex(activeColor) }];
	},

	onDraw(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): ToolEffects {
		if (previous !== null) return NO_EFFECTS;
		return wasm_flood_fill(ctx.canvas, current.x, current.y, ctx.drawColor)
			? CANVAS_CHANGED
			: NO_EFFECTS;
	},

	onDrawEnd(): void {}
};
