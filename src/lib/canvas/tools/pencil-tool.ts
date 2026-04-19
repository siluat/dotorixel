import type { DrawingToolType } from '../drawing-ops';
import type { ContinuousTool, ToolContext } from '../draw-tool';
import type { CanvasCoords } from '../canvas-model';

function createFreehandTool(
	toolType: DrawingToolType,
	addsActiveColor: boolean
): ContinuousTool {
	return {
		kind: 'continuous',
		addsActiveColor,

		apply(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): boolean {
			const ops = ctx.ops;
			const segment = previous
				? ops.interpolatePixels(previous.x, previous.y, current.x, current.y)
				: new Int32Array([current.x, current.y]);
			return ops.applyStroke(segment, toolType, ctx.drawColor);
		}
	};
}

/** Creates a freehand drawing tool that paints pixels with the active color. */
export function createPencilTool(): ContinuousTool {
	return createFreehandTool('pencil', true);
}

/** Creates a freehand tool that erases pixels to transparent. Does not add to recent colors. */
export function createEraserTool(): ContinuousTool {
	return createFreehandTool('eraser', false);
}
