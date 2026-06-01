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

export function clampSelectionDragPointerToViewport(
	pointer: SelectionDragAid['pointer'],
	viewportSize: ViewportSize
): { readonly x: number; readonly y: number } {
	return {
		x: clamp(pointer.x, 0, viewportSize.width),
		y: clamp(pointer.y, 0, viewportSize.height)
	};
}

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

export function formatSelectionDragDimensions(width: number, height: number): string {
	return `${Math.round(width)}×${Math.round(height)}`;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}
