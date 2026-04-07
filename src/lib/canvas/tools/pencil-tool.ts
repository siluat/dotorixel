import type { DrawingOps, DrawingToolType } from '../drawing-ops';
import type { ContinuousTool, ToolContext } from '../draw-tool';
import type { CanvasCoords } from '../view-types';

function createFreehandTool(
	ops: DrawingOps,
	toolType: DrawingToolType,
	addsActiveColor: boolean
): ContinuousTool {
	return {
		kind: 'continuous',
		addsActiveColor,

		apply(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): boolean {
			let changed = false;

			if (previous) {
				const flat = ops.interpolatePixels(previous.x, previous.y, current.x, current.y);
				for (let i = 0; i < flat.length; i += 2) {
					if (ops.applyTool(flat[i], flat[i + 1], toolType, ctx.drawColor)) {
						changed = true;
					}
				}
			} else {
				changed = ops.applyTool(current.x, current.y, toolType, ctx.drawColor);
			}

			return changed;
		}
	};
}

/** Creates a freehand drawing tool that paints pixels with the active color. */
export function createPencilTool(ops: DrawingOps): ContinuousTool {
	return createFreehandTool(ops, 'pencil', true);
}

/** Creates a freehand tool that erases pixels to transparent. Does not add to recent colors. */
export function createEraserTool(ops: DrawingOps): ContinuousTool {
	return createFreehandTool(ops, 'eraser', false);
}
