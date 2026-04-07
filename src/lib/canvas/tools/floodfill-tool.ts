import type { DrawingOps } from '../drawing-ops';
import { CANVAS_CHANGED, NO_EFFECTS, type OneShotTool, type ToolContext, type ToolEffects } from '../draw-tool';
import type { CanvasCoords } from '../view-types';

/** Creates a flood fill tool that fills connected same-color pixels on click. */
export function createFloodfillTool(ops: DrawingOps): OneShotTool {
	return {
		kind: 'oneShot',
		capturesHistory: true,
		addsActiveColor: true,

		execute(ctx: ToolContext, target: CanvasCoords): ToolEffects {
			return ops.floodFill(target.x, target.y, ctx.drawColor)
				? CANVAS_CHANGED
				: NO_EFFECTS;
		}
	};
}
