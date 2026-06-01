import type { ViewportSize } from './viewport';

export type SelectionDragPhase = 'defineMarquee' | 'liftAndDrag';

export interface SelectionDragAid {
	readonly phase: SelectionDragPhase;
	readonly pointer: {
		readonly x: number;
		readonly y: number;
	};
}

const TOOLTIP_MIN_WIDTH = 64;
const TOOLTIP_HEIGHT = 28;
const TOOLTIP_OFFSET = 16;
const VIEWPORT_PADDING = 8;
const TOOLTIP_CHARACTER_WIDTH = 8;
const TOOLTIP_HORIZONTAL_PADDING = 16;

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
	viewportSize: ViewportSize,
	tooltipWidth = TOOLTIP_MIN_WIDTH
): { readonly x: number; readonly y: number } {
	const maxX = Math.max(VIEWPORT_PADDING, viewportSize.width - tooltipWidth - VIEWPORT_PADDING);
	const maxY = Math.max(VIEWPORT_PADDING, viewportSize.height - TOOLTIP_HEIGHT - VIEWPORT_PADDING);
	return {
		x: clamp(pointer.x - tooltipWidth / 2, VIEWPORT_PADDING, maxX),
		y: clamp(pointer.y - TOOLTIP_HEIGHT - TOOLTIP_OFFSET, VIEWPORT_PADDING, maxY)
	};
}

export function estimateSelectionDragTooltipWidth(label: string, viewportSize: ViewportSize): number {
	const maxWidth = Math.max(0, viewportSize.width - VIEWPORT_PADDING * 2);
	const desiredWidth = Math.max(
		TOOLTIP_MIN_WIDTH,
		label.length * TOOLTIP_CHARACTER_WIDTH + TOOLTIP_HORIZONTAL_PADDING
	);
	return Math.min(desiredWidth, maxWidth);
}

export function formatSelectionDragDimensions(width: number, height: number): string {
	return `${Math.round(width)}×${Math.round(height)}`;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}
