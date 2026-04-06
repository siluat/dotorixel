import { shiftPixels } from '../shift-pixels';
import type { DragTransformTool, ToolContext } from '../draw-tool';
import type { CanvasCoords } from '../view-types';

/** Shifts all canvas pixels by drag delta from the initial click point. */
export const moveTool: DragTransformTool = {
	kind: 'dragTransform',

	applyTransform(
		ctx: ToolContext,
		snapshot: Uint8Array,
		start: CanvasCoords,
		current: CanvasCoords
	): void {
		const dx = current.x - start.x;
		const dy = current.y - start.y;
		const shifted = shiftPixels(snapshot, ctx.canvas.width, ctx.canvas.height, dx, dy);
		ctx.canvas.restore_pixels(shifted);
	}
};
