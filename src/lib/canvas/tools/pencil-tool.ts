import type { DrawingToolType } from '../drawing-ops';
import { continuousTool, type ApplyFn } from '../tool-authoring';

function freehandApply(toolType: DrawingToolType): ApplyFn {
	return (ctx, current, previous) => {
		const ops = ctx.ops;
		const segment = previous
			? ops.interpolatePixels(previous.x, previous.y, current.x, current.y)
			: new Int32Array([current.x, current.y]);
		return ops.applyStroke(segment, toolType, ctx.drawColor);
	};
}

/** Freehand drawing tool that paints pixels with the active color. */
export const pencilTool = continuousTool({
	id: 'pencil',
	apply: freehandApply('pencil')
});

/** Freehand tool that erases pixels to transparent. Does not add to recent colors. */
export const eraserTool = continuousTool({
	id: 'eraser',
	apply: freehandApply('eraser'),
	addsActiveColor: false
});
