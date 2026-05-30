import type { CanvasCoords, MarqueeRegion } from '../canvas-model';
import { MARQUEE_PREVIEW_CHANGED, NO_EFFECTS, type ToolEffects } from '../draw-tool';
import { customTool } from '../tool-authoring';
import { copyMarqueeRegion, marqueeRegionFromDrag } from '../wasm-backend';

function marqueeFromDrag(
	start: CanvasCoords,
	current: CanvasCoords,
	canvasWidth: number,
	canvasHeight: number
): MarqueeRegion | null {
	return marqueeRegionFromDrag(start.x, start.y, current.x, current.y).clip_to(
		canvasWidth,
		canvasHeight
	) ?? null;
}

export const selectionTool = customTool({
	id: 'selection',
	open(host) {
		let initialMarquee: MarqueeRegion | undefined;
		let anchor: CanvasCoords | null = null;
		let draftMarquee: MarqueeRegion | null = null;
		let hasDragged = false;

		function preview(region: MarqueeRegion | null): ToolEffects {
			draftMarquee = region;
			host.document.set_marquee(region ? copyMarqueeRegion(region) : null);
			return MARQUEE_PREVIEW_CHANGED;
		}

		return {
			start() {
				initialMarquee = host.document.marquee();
				return NO_EFFECTS;
			},
			draw(current, previous) {
				if (previous === null || anchor === null) {
					anchor = current;
					return NO_EFFECTS;
				}
				hasDragged = true;
				return preview(
					marqueeFromDrag(anchor, current, host.document.width, host.document.height)
				);
			},
			modifierChanged: () => NO_EFFECTS,
			end() {
				if (!anchor || !hasDragged) return NO_EFFECTS;
				host.document.set_marquee(initialMarquee ? copyMarqueeRegion(initialMarquee) : null);
				return [{ type: 'setMarquee', region: draftMarquee }];
			}
		};
	}
});
