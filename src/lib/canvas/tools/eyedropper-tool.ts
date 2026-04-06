import { colorToHex } from '../color';
import { NO_EFFECTS, type DrawTool, type ToolContext, type ToolEffects } from '../draw-tool';
import type { CanvasCoords } from '../view-types';

/** Samples a pixel color on first click. Does not modify the canvas or capture history. */
export const eyedropperTool: DrawTool = {
	capturesHistory: false,

	onDrawStart(): ToolEffects {
		return NO_EFFECTS;
	},

	onDraw(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): ToolEffects {
		if (previous !== null) return NO_EFFECTS;

		const pixel = ctx.canvas.get_pixel(current.x, current.y);
		if (pixel.a === 0) return NO_EFFECTS;

		const isRightClick = ctx.drawButton === 2;
		const color = { r: pixel.r, g: pixel.g, b: pixel.b, a: pixel.a };
		return [
			{ type: 'colorPick', target: isRightClick ? 'background' : 'foreground', color },
			{ type: 'addRecentColor', hex: colorToHex(color) }
		];
	},

	onDrawEnd(): void {}
};
