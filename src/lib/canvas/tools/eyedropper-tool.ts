import { colorToHex } from '../color';
import { EMPTY_RESULT, type DrawTool, type DrawResult, type ToolContext } from '../draw-tool';
import type { CanvasCoords } from '../view-types';

export const eyedropperTool: DrawTool = {
	capturesHistory: false,

	onDrawStart(): DrawResult {
		return EMPTY_RESULT;
	},

	onDraw(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): DrawResult {
		if (previous !== null) return EMPTY_RESULT;

		const pixel = ctx.canvas.get_pixel(current.x, current.y);
		if (pixel.a === 0) return EMPTY_RESULT;

		const isRightClick = ctx.drawButton === 2;
		const color = { r: pixel.r, g: pixel.g, b: pixel.b, a: pixel.a };
		return {
			canvasChanged: false,
			colorPick: {
				target: isRightClick ? 'background' : 'foreground',
				color
			},
			addRecentColor: colorToHex(color)
		};
	},

	onDrawEnd(): void {}
};
