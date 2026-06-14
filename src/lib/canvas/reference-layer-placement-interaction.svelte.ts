import type { ReferencePlacement } from './canvas-model';
import type { PointerType } from './canvas-interaction.svelte';
import type { ReferenceLayerUnderlay } from './reference-layer-underlay';

export type ReferencePlacementHandle = 'nw' | 'ne' | 'se' | 'sw';

export interface ReferencePlacementDragBeginInput {
	readonly pointerId: number;
	readonly pointerType: PointerType;
	readonly button: number;
	readonly clientX: number;
	readonly clientY: number;
	readonly localX: number;
	readonly localY: number;
	readonly referenceLayerUnderlay?: ReferenceLayerUnderlay;
	readonly isReferenceLayerActive: boolean;
	readonly isSpaceHeld: boolean;
	readonly handle: ReferencePlacementHandle | null;
	readonly canMoveBody: boolean;
}

export interface ReferencePlacementDragUpdateInput {
	readonly pointerId: number;
	readonly clientX: number;
	readonly clientY: number;
	readonly localX: number;
	readonly localY: number;
	readonly scaledCanvasPixel: number;
}

export interface ReferencePlacementNudgeInput {
	readonly code: string;
	readonly shiftKey: boolean;
	readonly ctrlKey: boolean;
	readonly metaKey: boolean;
	readonly altKey: boolean;
	readonly isKeyboardTarget: boolean;
	readonly referenceLayerUnderlay?: ReferenceLayerUnderlay;
	readonly isReferenceLayerActive: boolean;
}

export interface ActiveTouchPlacementDrag {
	readonly pointerId: number;
	readonly localX: number;
	readonly localY: number;
}

type PlacementDragKind =
	| { readonly type: 'move' }
	| {
			readonly type: 'scale';
			readonly handle: ReferencePlacementHandle;
			readonly naturalWidth: number;
			readonly naturalHeight: number;
	  };

interface PlacementDrag {
	readonly pointerId: number;
	readonly startClientX: number;
	readonly startClientY: number;
	readonly currentLocalX: number;
	readonly currentLocalY: number;
	readonly startPlacement: ReferencePlacement;
	readonly currentPlacement: ReferencePlacement;
	readonly pointerType: PointerType;
	readonly kind: PlacementDragKind;
}

type PlacementNudge = { readonly x: number; readonly y: number };

const MIN_REFERENCE_PROJECTED_SIZE = 8;

export function createReferenceLayerPlacementInteraction() {
	let draftPlacement = $state<ReferencePlacement | null>(null);
	let drag = $state<PlacementDrag | null>(null);

	function clear(): void {
		draftPlacement = null;
		drag = null;
	}

	function documentDeltaFromDrag(input: ReferencePlacementDragUpdateInput): PlacementNudge | null {
		if (!drag || input.scaledCanvasPixel <= 0) return null;
		return {
			x: (input.clientX - drag.startClientX) / input.scaledCanvasPixel,
			y: (input.clientY - drag.startClientY) / input.scaledCanvasPixel
		};
	}

	function placementFromBodyDrag(input: ReferencePlacementDragUpdateInput): ReferencePlacement | null {
		if (!drag) return null;
		const delta = documentDeltaFromDrag(input);
		if (!delta) return null;
		return {
			x: drag.startPlacement.x + delta.x,
			y: drag.startPlacement.y + delta.y,
			scale: drag.startPlacement.scale,
			rotation: drag.startPlacement.rotation
		};
	}

	function placementFromScaleDrag(input: ReferencePlacementDragUpdateInput): ReferencePlacement | null {
		if (!drag || drag.kind.type !== 'scale') return null;
		const delta = documentDeltaFromDrag(input);
		if (!delta) return null;

		const { handle, naturalWidth, naturalHeight } = drag.kind;
		const start = drag.startPlacement;
		const signs = scaleDragSigns(handle);
		const basisX = signs.x * naturalWidth;
		const basisY = signs.y * naturalHeight;
		const candidateX = signs.x * naturalWidth * start.scale + delta.x;
		const candidateY = signs.y * naturalHeight * start.scale + delta.y;
		const rawScale =
			(candidateX * basisX + candidateY * basisY) / (basisX * basisX + basisY * basisY);
		const minScale = Math.max(
			MIN_REFERENCE_PROJECTED_SIZE / naturalWidth,
			MIN_REFERENCE_PROJECTED_SIZE / naturalHeight
		);
		const scale = Math.max(rawScale, minScale);
		const width = naturalWidth * scale;
		const height = naturalHeight * scale;
		const startRight = start.x + naturalWidth * start.scale;
		const startBottom = start.y + naturalHeight * start.scale;

		const rotation = start.rotation;
		switch (handle) {
			case 'nw':
				return { x: startRight - width, y: startBottom - height, scale, rotation };
			case 'ne':
				return { x: start.x, y: startBottom - height, scale, rotation };
			case 'se':
				return { x: start.x, y: start.y, scale, rotation };
			case 'sw':
				return { x: startRight - width, y: start.y, scale, rotation };
		}
	}

	function placementFromDrag(input: ReferencePlacementDragUpdateInput): ReferencePlacement | null {
		if (drag?.kind.type === 'scale') return placementFromScaleDrag(input);
		return placementFromBodyDrag(input);
	}

	function nudgeDelta(input: ReferencePlacementNudgeInput): PlacementNudge | null {
		if (input.ctrlKey || input.metaKey || input.altKey) return null;
		const step = input.shiftKey ? 10 : 1;
		switch (input.code) {
			case 'ArrowUp':
				return { x: 0, y: -step };
			case 'ArrowDown':
				return { x: 0, y: step };
			case 'ArrowLeft':
				return { x: -step, y: 0 };
			case 'ArrowRight':
				return { x: step, y: 0 };
			default:
				return null;
		}
	}

	return {
		get isDragging(): boolean {
			return drag !== null;
		},

		displayedUnderlay(referenceLayerUnderlay?: ReferenceLayerUnderlay): ReferenceLayerUnderlay | undefined {
			return referenceLayerUnderlay && draftPlacement
				? { ...referenceLayerUnderlay, placement: draftPlacement }
				: referenceLayerUnderlay;
		},

		beginDrag(input: ReferencePlacementDragBeginInput): boolean {
			if (
				!input.referenceLayerUnderlay ||
				!input.isReferenceLayerActive ||
				input.isSpaceHeld ||
				input.button !== 0
			) {
				return false;
			}
			if (!input.handle && !input.canMoveBody) return false;

			const startPlacement = input.referenceLayerUnderlay.placement;
			drag = {
				pointerId: input.pointerId,
				startClientX: input.clientX,
				startClientY: input.clientY,
				currentLocalX: input.localX,
				currentLocalY: input.localY,
				startPlacement,
				currentPlacement: startPlacement,
				pointerType: input.pointerType,
				kind: input.handle
					? {
							type: 'scale',
							handle: input.handle,
							naturalWidth: input.referenceLayerUnderlay.naturalWidth,
							naturalHeight: input.referenceLayerUnderlay.naturalHeight
						}
					: { type: 'move' }
			};
			draftPlacement = startPlacement;
			return true;
		},

		updateDrag(input: ReferencePlacementDragUpdateInput): boolean {
			if (!drag || drag.pointerId !== input.pointerId) return false;
			const next = placementFromDrag(input);
			if (!next) return false;
			drag = {
				...drag,
				currentPlacement: next,
				currentLocalX: input.localX,
				currentLocalY: input.localY
			};
			draftPlacement = next;
			return true;
		},

		commitDrag(pointerId: number): ReferencePlacement | null {
			if (!drag || drag.pointerId !== pointerId) return null;
			const placement = drag.currentPlacement;
			clear();
			return placement;
		},

		cancelDrag(pointerId: number): boolean {
			if (!drag || drag.pointerId !== pointerId) return false;
			clear();
			return true;
		},

		activeTouchDrag(): ActiveTouchPlacementDrag | null {
			if (!drag || drag.pointerType !== 'touch') return null;
			return {
				pointerId: drag.pointerId,
				localX: drag.currentLocalX,
				localY: drag.currentLocalY
			};
		},

		cancelActiveTouchDrag(): ActiveTouchPlacementDrag | null {
			if (!drag || drag.pointerType !== 'touch') return null;
			const active = {
				pointerId: drag.pointerId,
				localX: drag.currentLocalX,
				localY: drag.currentLocalY
			};
			clear();
			return active;
		},

		cancelAll(): void {
			clear();
		},

		reconcileCommittedPlacement(referenceLayerUnderlay?: ReferenceLayerUnderlay): void {
			if (!draftPlacement || drag || !referenceLayerUnderlay) return;
			if (isSameReferencePlacement(referenceLayerUnderlay.placement, draftPlacement)) {
				draftPlacement = null;
			}
		},

		nudge(input: ReferencePlacementNudgeInput): ReferencePlacement | null {
			const delta = nudgeDelta(input);
			if (!delta) return null;
			if (!input.referenceLayerUnderlay || !input.isReferenceLayerActive || drag) return null;
			if (!input.isKeyboardTarget) return null;
			const placement = draftPlacement ?? input.referenceLayerUnderlay.placement;
			const next = {
				x: placement.x + delta.x,
				y: placement.y + delta.y,
				scale: placement.scale,
				rotation: placement.rotation
			};
			draftPlacement = next;
			return next;
		}
	};
}

function scaleDragSigns(handle: ReferencePlacementHandle): { x: -1 | 1; y: -1 | 1 } {
	switch (handle) {
		case 'nw':
			return { x: -1, y: -1 };
		case 'ne':
			return { x: 1, y: -1 };
		case 'se':
			return { x: 1, y: 1 };
		case 'sw':
			return { x: -1, y: 1 };
	}
}

function isSameReferencePlacement(a: ReferencePlacement, b: ReferencePlacement): boolean {
	return a.x === b.x && a.y === b.y && a.scale === b.scale;
}
