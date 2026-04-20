import { CANVAS_CHANGED, NO_EFFECTS } from '../draw-tool';
import { oneShotTool } from '../tool-authoring';

/** Flood fill tool — fills the connected same-color region on click. */
export const floodfillTool = oneShotTool({
	id: 'floodfill',
	execute: (ctx, target) =>
		ctx.ops.floodFill(target.x, target.y, ctx.drawColor) ? CANVAS_CHANGED : NO_EFFECTS
});
