import type { DrawingOps, DrawingToolType } from '../drawing-ops';
import type { ShapePreviewTool, ToolContext } from '../draw-tool';
import type { CanvasCoords } from '../canvas-types';

type ShapePixelsFn = (x0: number, y0: number, x1: number, y1: number) => Int32Array;
type ConstrainFn = (start: CanvasCoords, end: CanvasCoords) => CanvasCoords;

/**
 * Creates a shape tool with framework-managed snapshot-restore preview.
 * ToolRunner captures and restores the canvas snapshot; the tool only stamps pixels.
 */
export function createShapeTool(
	ops: DrawingOps,
	toolType: DrawingToolType,
	generatePixels: ShapePixelsFn,
	constrainFn: ConstrainFn
): ShapePreviewTool {
	return {
		kind: 'shapePreview',
		addsActiveColor: true,
		constrainFn,

		onAnchor(ctx: ToolContext, start: CanvasCoords): void {
			ops.applyTool(start.x, start.y, toolType, ctx.drawColor);
		},

		onPreview(ctx: ToolContext, start: CanvasCoords, end: CanvasCoords): void {
			const flat = generatePixels(start.x, start.y, end.x, end.y);
			for (let i = 0; i < flat.length; i += 2) {
				ops.applyTool(flat[i], flat[i + 1], toolType, ctx.drawColor);
			}
		}
	};
}
