import type { CanvasCoords, Document, MarqueeRegion } from '../canvas-model';
import { MARQUEE_PREVIEW_CHANGED, NO_EFFECTS, type ToolEffects } from '../draw-tool';
import { customTool } from '../tool-authoring';
import { copyMarqueeRegion, marqueeRegionFromDrag } from '../wasm-backend';

function canvasCoordsFromPoint(point: CanvasCoords): CanvasCoords {
	return { x: Math.floor(point.x), y: Math.floor(point.y) };
}

function isReferenceLayerActive(document: Document): boolean {
	const activeLayerId = document.active_layer_id();
	for (let index = 0; index < document.layer_count(); index++) {
		if (document.layer_id_at(index) !== activeLayerId) continue;
		return document.layer_kind_at(index) === 'reference';
	}
	return false;
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

type SelectionStrokeMode = 'pending' | 'defineMarquee' | 'liftAndDrag';

export const selectionTool = customTool({
	id: 'selection',
	open(host) {
		let initialMarquee: MarqueeRegion | undefined;
		let anchor: CanvasCoords | null = null;
		let draftMarquee: MarqueeRegion | null = null;
		let hasUserDragged = false;
		let mode: SelectionStrokeMode = 'pending';
		let hasFloatingSelectionStarted = false;

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
				if (isReferenceLayerActive(host.document)) return NO_EFFECTS;
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
				if (mode === 'liftAndDrag' && initialMarquee) {
					const moveEffect = {
						type: 'moveFloatingSelection' as const,
						offset: { dx: currentCoords.x - anchor.x, dy: currentCoords.y - anchor.y }
					};
					if (hasFloatingSelectionStarted) return [moveEffect];
					hasFloatingSelectionStarted = true;
					return [{ type: 'beginFloatingSelection', sourceRegion: initialMarquee }, moveEffect];
				}
				return preview(
					marqueeFromDrag(anchor, currentCoords, host.document.width, host.document.height)
				);
			},
			modifierChanged: () => NO_EFFECTS,
			end() {
				if (isReferenceLayerActive(host.document)) return NO_EFFECTS;
				if (!anchor) return NO_EFFECTS;
				if (mode === 'liftAndDrag') {
					return hasFloatingSelectionStarted ? [{ type: 'commitFloatingSelection' }] : NO_EFFECTS;
				}
				if (!hasUserDragged) {
					if (initialMarquee && !initialMarquee.contains(anchor.x, anchor.y)) {
						return [{ type: 'setMarquee', region: null }];
					}
					return NO_EFFECTS;
				}
				host.document.set_marquee(initialMarquee ? copyMarqueeRegion(initialMarquee) : null);
				if (draftMarquee === null) return MARQUEE_PREVIEW_CHANGED;
				return [{ type: 'setMarquee', region: draftMarquee }];
			},
			cancel() {
				if (!hasUserDragged) return NO_EFFECTS;
				if (mode === 'liftAndDrag') {
					anchor = null;
					hasUserDragged = false;
					mode = 'pending';
					hasFloatingSelectionStarted = false;
					return [{ type: 'cancelFloatingSelection' }];
				}
				host.document.set_marquee(initialMarquee ? copyMarqueeRegion(initialMarquee) : null);
				anchor = null;
				draftMarquee = null;
				hasUserDragged = false;
				mode = 'pending';
				return MARQUEE_PREVIEW_CHANGED;
			}
		};
	}
});
