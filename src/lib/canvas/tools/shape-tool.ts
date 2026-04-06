import { type WasmToolType, apply_tool } from '$wasm/dotorixel_wasm';
import type { ShapePreviewTool, ToolContext } from '../draw-tool';
import type { CanvasCoords } from '../view-types';

type ShapePixelsFn = (x0: number, y0: number, x1: number, y1: number) => Int32Array;
type ConstrainFn = (start: CanvasCoords, end: CanvasCoords) => CanvasCoords;

/**
 * Creates a shape tool with framework-managed snapshot-restore preview.
 * ToolRunner captures and restores the canvas snapshot; the tool only stamps pixels.
 */
export function createShapeTool(
	wasmTool: WasmToolType,
	generatePixels: ShapePixelsFn,
	constrainFn: ConstrainFn
): ShapePreviewTool {
	return {
		kind: 'shapePreview',
		addsActiveColor: true,
		constrainFn,

		onAnchor(ctx: ToolContext, start: CanvasCoords): void {
			apply_tool(ctx.canvas, start.x, start.y, wasmTool, ctx.drawColor);
		},

		onPreview(ctx: ToolContext, start: CanvasCoords, end: CanvasCoords): void {
			const flat = generatePixels(start.x, start.y, end.x, end.y);
			for (let i = 0; i < flat.length; i += 2) {
				apply_tool(ctx.canvas, flat[i], flat[i + 1], wasmTool, ctx.drawColor);
			}
		}
	};
}
