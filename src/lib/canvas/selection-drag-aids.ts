import type { ViewportSize } from './viewport';

export type SelectionDragPhase = 'defineMarquee' | 'liftAndDrag';

export interface SelectionDragAid {
	readonly phase: SelectionDragPhase;
	readonly pointer: {
		readonly x: number;
		readonly y: number;
	};
}

const TOOLTIP_WIDTH = 64;
const TOOLTIP_HEIGHT = 28;
const TOOLTIP_OFFSET = 16;
const VIEWPORT_PADDING = 8;

export function computeSelectionDragTooltipPosition(
	pointer: SelectionDragAid['pointer'],
	viewportSize: ViewportSize
): { readonly x: number; readonly y: number } {
	const maxX = Math.max(VIEWPORT_PADDING, viewportSize.width - TOOLTIP_WIDTH - VIEWPORT_PADDING);
	const maxY = Math.max(VIEWPORT_PADDING, viewportSize.height - TOOLTIP_HEIGHT - VIEWPORT_PADDING);
	return {
		x: clamp(pointer.x - TOOLTIP_WIDTH / 2, VIEWPORT_PADDING, maxX),
		y: clamp(pointer.y - TOOLTIP_HEIGHT - TOOLTIP_OFFSET, VIEWPORT_PADDING, maxY)
	};
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}
