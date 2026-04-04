import { shiftPixels } from '../shift-pixels';
import { EMPTY_RESULT, type DrawTool, type DrawResult, type ToolContext } from '../draw-tool';
import type { CanvasCoords } from '../view-types';

export function createMoveTool(): DrawTool {
	let moveStart: CanvasCoords | null = null;
	let moveSnapshot: Uint8Array | null = null;

	return {
		capturesHistory: true,

		onDrawStart(ctx: ToolContext): DrawResult {
			moveSnapshot = new Uint8Array(ctx.canvas.pixels());
			moveStart = null;
			return EMPTY_RESULT;
		},

		onDraw(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): DrawResult {
			if (previous === null) {
				moveStart = current;
				return EMPTY_RESULT;
			}
			if (!moveStart || !moveSnapshot) return EMPTY_RESULT;

			const dx = current.x - moveStart.x;
			const dy = current.y - moveStart.y;
			const shifted = shiftPixels(moveSnapshot, ctx.canvas.width, ctx.canvas.height, dx, dy);
			ctx.canvas.restore_pixels(shifted);
			return { canvasChanged: true };
		},

		onDrawEnd(): void {
			moveStart = null;
			moveSnapshot = null;
		}
	};
}
