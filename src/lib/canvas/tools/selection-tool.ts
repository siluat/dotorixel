import type { CanvasCoords, MarqueeRegion } from '../canvas-model';
import { MARQUEE_PREVIEW_CHANGED, NO_EFFECTS, type ToolEffects } from '../draw-tool';
import { constrainAxis } from '../tool-constraints';
import { customTool } from '../tool-authoring';
import { copyMarqueeRegion, marqueeRegionFromDrag } from '../wasm-backend';

function canvasCoordsFromPoint(point: CanvasCoords): CanvasCoords {
	return { x: Math.floor(point.x), y: Math.floor(point.y) };
}

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

function isInsideCanvas(point: CanvasCoords, canvasWidth: number, canvasHeight: number): boolean {
	return point.x >= 0 && point.y >= 0 && point.x < canvasWidth && point.y < canvasHeight;
}

function clampToCanvas(point: CanvasCoords, canvasWidth: number, canvasHeight: number): CanvasCoords {
	return {
		x: Math.min(Math.max(point.x, 0), canvasWidth - 1),
		y: Math.min(Math.max(point.y, 0), canvasHeight - 1)
	};
}

function constrainSquareWithinCanvas(
	start: CanvasCoords,
	current: CanvasCoords,
	canvasWidth: number,
	canvasHeight: number
): CanvasCoords {
	const dx = current.x - start.x;
	const dy = current.y - start.y;
	const side = Math.max(Math.abs(dx), Math.abs(dy));
	const maxX = dx >= 0 ? canvasWidth - 1 - start.x : start.x;
	const maxY = dy >= 0 ? canvasHeight - 1 - start.y : start.y;
	const boundedSide = Math.min(side, maxX, maxY);

	return {
		x: start.x + boundedSide * (dx >= 0 ? 1 : -1),
		y: start.y + boundedSide * (dy >= 0 ? 1 : -1)
	};
}

function squareMarqueeFromDrag(
	start: CanvasCoords,
	current: CanvasCoords,
	canvasWidth: number,
	canvasHeight: number
): MarqueeRegion | null {
	if (marqueeFromDrag(start, current, canvasWidth, canvasHeight) === null) return null;
	const squareStart = isInsideCanvas(start, canvasWidth, canvasHeight)
		? start
		: clampToCanvas(start, canvasWidth, canvasHeight);
	const squareEnd = constrainSquareWithinCanvas(squareStart, current, canvasWidth, canvasHeight);
	return marqueeFromDrag(squareStart, squareEnd, canvasWidth, canvasHeight);
}

type SelectionStrokeMode = 'pending' | 'defineMarquee' | 'liftAndDrag';
type FloatingSelectionAxisLock = 'horizontal' | 'vertical';

export const selectionTool = customTool({
	id: 'selection',
	open(host) {
		let initialMarquee: MarqueeRegion | undefined;
		let anchor: CanvasCoords | null = null;
		let lastCurrentCoords: CanvasCoords | null = null;
		let draftMarquee: MarqueeRegion | null = null;
		let hasUserDragged = false;
		let mode: SelectionStrokeMode = 'pending';
		let hasFloatingSelectionStarted = false;
		let floatingAxisLock: FloatingSelectionAxisLock | null = null;

		function preview(region: MarqueeRegion | null): ToolEffects {
			draftMarquee = region;
			host.document.set_marquee(region ? copyMarqueeRegion(region) : null);
			return MARQUEE_PREVIEW_CHANGED;
		}

		function previewMarqueeFromDrag(currentCoords: CanvasCoords): ToolEffects {
			if (!anchor) return NO_EFFECTS;
			const region = host.isShiftHeld()
				? squareMarqueeFromDrag(anchor, currentCoords, host.document.width, host.document.height)
				: marqueeFromDrag(anchor, currentCoords, host.document.width, host.document.height);
			return preview(region);
		}

		function applyAxisLock(
			anchorCoords: CanvasCoords,
			currentCoords: CanvasCoords,
			axis: FloatingSelectionAxisLock
		): CanvasCoords {
			return axis === 'horizontal'
				? { x: currentCoords.x, y: anchorCoords.y }
				: { x: anchorCoords.x, y: currentCoords.y };
		}

		function resolveFloatingOffsetFromDrag(anchorCoords: CanvasCoords, currentCoords: CanvasCoords) {
			if (!host.isShiftHeld()) {
				floatingAxisLock = null;
				return { dx: currentCoords.x - anchorCoords.x, dy: currentCoords.y - anchorCoords.y };
			}

			if (!floatingAxisLock) {
				const constrainedCurrent = constrainAxis(anchorCoords, currentCoords);
				floatingAxisLock = constrainedCurrent.y === anchorCoords.y ? 'horizontal' : 'vertical';
				return { dx: constrainedCurrent.x - anchorCoords.x, dy: constrainedCurrent.y - anchorCoords.y };
			}

			const constrainedCurrent = applyAxisLock(anchorCoords, currentCoords, floatingAxisLock);
			return { dx: constrainedCurrent.x - anchorCoords.x, dy: constrainedCurrent.y - anchorCoords.y };
		}

		function resetStrokeState() {
			initialMarquee = undefined;
			anchor = null;
			lastCurrentCoords = null;
			draftMarquee = null;
			hasUserDragged = false;
			mode = 'pending';
			hasFloatingSelectionStarted = false;
			floatingAxisLock = null;
		}

		return {
			start() {
				initialMarquee = host.document.marquee();
				return NO_EFFECTS;
			},
			draw(current, previous) {
				if (previous === null || anchor === null) {
					anchor = canvasCoordsFromPoint(current);
					mode =
						initialMarquee && initialMarquee.contains(anchor.x, anchor.y)
							? 'liftAndDrag'
							: 'defineMarquee';
					return NO_EFFECTS;
				}
				const currentCoords = canvasCoordsFromPoint(current);
				if (!hasUserDragged && currentCoords.x === anchor.x && currentCoords.y === anchor.y) {
					return NO_EFFECTS;
				}
				hasUserDragged = true;
				lastCurrentCoords = currentCoords;
				if (mode === 'liftAndDrag' && initialMarquee) {
					const moveEffect = {
						type: 'moveFloatingSelection' as const,
						offset: resolveFloatingOffsetFromDrag(anchor, currentCoords)
					};
					if (hasFloatingSelectionStarted) return [moveEffect];
					hasFloatingSelectionStarted = true;
					return [{ type: 'beginFloatingSelection', sourceRegion: initialMarquee }, moveEffect];
				}
				return previewMarqueeFromDrag(currentCoords);
			},
			modifierChanged() {
				if (!anchor || !hasUserDragged || !lastCurrentCoords) return NO_EFFECTS;
				if (mode === 'defineMarquee') return previewMarqueeFromDrag(lastCurrentCoords);
				if (mode === 'liftAndDrag' && hasFloatingSelectionStarted) {
					return [
						{
							type: 'moveFloatingSelection',
							offset: resolveFloatingOffsetFromDrag(anchor, lastCurrentCoords)
						}
					];
				}
				return NO_EFFECTS;
			},
			end() {
				if (!anchor) {
					resetStrokeState();
					return NO_EFFECTS;
				}
				if (mode === 'liftAndDrag') {
					resetStrokeState();
					return NO_EFFECTS;
				}
				if (!hasUserDragged) {
					const shouldClearMarquee = initialMarquee && !initialMarquee.contains(anchor.x, anchor.y);
					resetStrokeState();
					if (shouldClearMarquee) {
						return [{ type: 'setMarquee', region: null }];
					}
					return NO_EFFECTS;
				}
				const committedMarquee = draftMarquee;
				host.document.set_marquee(initialMarquee ? copyMarqueeRegion(initialMarquee) : null);
				resetStrokeState();
				if (committedMarquee === null) return MARQUEE_PREVIEW_CHANGED;
				return [{ type: 'setMarquee', region: committedMarquee }];
			},
			cancel() {
				if (!hasUserDragged) {
					resetStrokeState();
					return NO_EFFECTS;
				}
				if (mode === 'liftAndDrag') {
					resetStrokeState();
					return [{ type: 'cancelFloatingSelection' }];
				}
				host.document.set_marquee(initialMarquee ? copyMarqueeRegion(initialMarquee) : null);
				resetStrokeState();
				return MARQUEE_PREVIEW_CHANGED;
			}
		};
	}
});
