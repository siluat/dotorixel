import { wasm_flood_fill } from '$wasm/dotorixel_wasm';
import { CANVAS_CHANGED, NO_EFFECTS, type OneShotTool, type ToolContext, type ToolEffects } from '../draw-tool';
import type { CanvasCoords } from '../view-types';

/** Fills connected same-color pixels on click. Ignores drag events. */
export const floodfillTool: OneShotTool = {
	kind: 'oneShot',
	capturesHistory: true,
	addsActiveColor: true,

	execute(ctx: ToolContext, target: CanvasCoords): ToolEffects {
		return wasm_flood_fill(ctx.canvas, target.x, target.y, ctx.drawColor)
			? CANVAS_CHANGED
			: NO_EFFECTS;
	}
};
