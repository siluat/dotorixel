import { colorToHex } from '../color';
import { NO_EFFECTS, type OneShotTool, type ToolContext, type ToolEffects } from '../draw-tool';
import type { CanvasCoords } from '../view-types';

/** Samples a pixel color on click. Does not modify the canvas or capture history. */
export const eyedropperTool: OneShotTool = {
	kind: 'oneShot',
	capturesHistory: false,
	addsActiveColor: false,

	execute(ctx: ToolContext, target: CanvasCoords): ToolEffects {
		const pixel = ctx.canvas.get_pixel(target.x, target.y);
		if (pixel.a === 0) return NO_EFFECTS;

		const isRightClick = ctx.drawButton === 2;
		const color = { r: pixel.r, g: pixel.g, b: pixel.b, a: pixel.a };
		return [
			{ type: 'colorPick', target: isRightClick ? 'background' : 'foreground', color },
			{ type: 'addRecentColor', hex: colorToHex(color) }
		];
	}
};
