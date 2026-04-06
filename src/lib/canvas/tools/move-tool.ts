import { shiftPixels } from '../shift-pixels';
import { CANVAS_CHANGED, NO_EFFECTS, type DrawTool, type ToolContext, type ToolEffects } from '../draw-tool';
import type { CanvasCoords } from '../view-types';

/** Creates a move tool that shifts all canvas pixels by drag delta from the initial click point. */
export function createMoveTool(): DrawTool {
	let moveStart: CanvasCoords | null = null;
	let moveSnapshot: Uint8Array | null = null;

	return {
		capturesHistory: true,

		onDrawStart(ctx: ToolContext): ToolEffects {
			moveSnapshot = new Uint8Array(ctx.canvas.pixels());
			moveStart = null;
			return NO_EFFECTS;
		},

		onDraw(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): ToolEffects {
			if (previous === null) {
				moveStart = current;
				return NO_EFFECTS;
			}
			if (!moveStart || !moveSnapshot) return NO_EFFECTS;

			const dx = current.x - moveStart.x;
			const dy = current.y - moveStart.y;
			const shifted = shiftPixels(moveSnapshot, ctx.canvas.width, ctx.canvas.height, dx, dy);
			ctx.canvas.restore_pixels(shifted);
			return CANVAS_CHANGED;
		},

		onDrawEnd(): void {
			moveStart = null;
			moveSnapshot = null;
		}
	};
}
