import { describe, expect, it } from 'vitest';
import {
	createReferenceLayerPlacementInteraction,
	type ReferencePlacementHandle
} from './reference-layer-placement-interaction.svelte';
import type { ReferenceLayerUnderlay } from './reference-layer-underlay';

const referenceLayerUnderlay: ReferenceLayerUnderlay = {
	sourceKey: 'reference',
	sourceRgba: new Uint8Array(2 * 1 * 4),
	naturalWidth: 2,
	naturalHeight: 1,
	placement: { x: 0.5, y: 1, scale: 2 },
	projectedBounds: { minX: 0.5, minY: 1, maxX: 4.5, maxY: 3 },
	opacity: 1
};

const squareReferenceLayerUnderlay: ReferenceLayerUnderlay = {
	...referenceLayerUnderlay,
	naturalWidth: 4,
	naturalHeight: 4,
	placement: { x: 1, y: 1, scale: 2 },
	projectedBounds: { minX: 1, minY: 1, maxX: 9, maxY: 9 }
};

const largeSquareReferenceLayerUnderlay: ReferenceLayerUnderlay = {
	...squareReferenceLayerUnderlay,
	placement: { x: 1, y: 1, scale: 3 },
	projectedBounds: { minX: 1, minY: 1, maxX: 13, maxY: 13 }
};

function beginDrag(
	interaction: ReturnType<typeof createReferenceLayerPlacementInteraction>,
	overrides: {
		handle?: ReferencePlacementHandle | null;
		canMoveBody?: boolean;
		pointerType?: 'mouse' | 'pen' | 'touch';
		referenceLayerUnderlay?: ReferenceLayerUnderlay;
	} = {}
) {
	return interaction.beginDrag({
		pointerId: 1,
		pointerType: overrides.pointerType ?? 'mouse',
		button: 0,
		clientX: 10,
		clientY: 20,
		localX: 10,
		localY: 20,
		referenceLayerUnderlay: overrides.referenceLayerUnderlay ?? referenceLayerUnderlay,
		isReferenceLayerActive: true,
		isSpaceHeld: false,
		handle: overrides.handle ?? null,
		canMoveBody: overrides.canMoveBody ?? true
	});
}

describe('Reference Layer Placement Interaction', () => {
	it('rejects body drag starts when body movement is not enabled', () => {
		const interaction = createReferenceLayerPlacementInteraction();

		expect(beginDrag(interaction, { canMoveBody: false })).toBe(false);
		expect(interaction.isDragging).toBe(false);
	});

	it('translates a body drag in document-pixel space', () => {
		const interaction = createReferenceLayerPlacementInteraction();
		expect(beginDrag(interaction)).toBe(true);

		expect(
			interaction.updateDrag({
				pointerId: 1,
				clientX: 30,
				clientY: 10,
				localX: 30,
				localY: 10,
				scaledCanvasPixel: 10
			})
		).toBe(true);

		expect(interaction.commitDrag(1)).toEqual({ x: 2.5, y: 0, scale: 2 });
	});

	it('scales uniformly from a corner handle around the opposite corner', () => {
		const interaction = createReferenceLayerPlacementInteraction();
		expect(
			beginDrag(interaction, {
				handle: 'se',
				canMoveBody: false,
				referenceLayerUnderlay: squareReferenceLayerUnderlay
			})
		).toBe(true);

		interaction.updateDrag({
			pointerId: 1,
			clientX: 30,
			clientY: 40,
			localX: 30,
			localY: 40,
			scaledCanvasPixel: 10
		});

		expect(interaction.commitDrag(1)).toEqual({ x: 1, y: 1, scale: 2.5 });
	});

	it('translates the displayed footprint to follow a body drag', () => {
		const interaction = createReferenceLayerPlacementInteraction();
		beginDrag(interaction);
		interaction.updateDrag({
			pointerId: 1,
			clientX: 30,
			clientY: 10,
			localX: 30,
			localY: 10,
			scaledCanvasPixel: 10
		});

		// Same scale, so the committed 4×2 footprint just shifts to the draft origin.
		expect(interaction.displayedUnderlay(referenceLayerUnderlay)).toMatchObject({
			placement: { x: 2.5, y: 0, scale: 2 },
			projectedBounds: { minX: 2.5, minY: 0, maxX: 6.5, maxY: 2 }
		});
	});

	it('rescales the displayed footprint to follow a corner-scale draft', () => {
		const interaction = createReferenceLayerPlacementInteraction();
		beginDrag(interaction, {
			handle: 'se',
			canMoveBody: false,
			referenceLayerUnderlay: squareReferenceLayerUnderlay
		});
		interaction.updateDrag({
			pointerId: 1,
			clientX: 30,
			clientY: 40,
			localX: 30,
			localY: 40,
			scaledCanvasPixel: 10
		});

		// The committed 8×8 footprint (scale 2) grows to 10×10 at draft scale 2.5,
		// anchored at the unchanged top-left corner — the rotation-aware projection
		// stays the core's job and is never recomputed here.
		expect(interaction.displayedUnderlay(squareReferenceLayerUnderlay)).toMatchObject({
			placement: { x: 1, y: 1, scale: 2.5 },
			projectedBounds: { minX: 1, minY: 1, maxX: 11, maxY: 11 }
		});
	});

	it('preserves the rotated footprint dimensions through a body drag', () => {
		const interaction = createReferenceLayerPlacementInteraction();
		// A 2×1 source at a quarter-turn: its projected box is swapped to 2 wide × 4
		// tall. The preview must keep that rotated shape while translating.
		const rotated: ReferenceLayerUnderlay = {
			...referenceLayerUnderlay,
			placement: { x: 1, y: 1, scale: 2, rotation: 1 },
			projectedBounds: { minX: 1, minY: 1, maxX: 3, maxY: 5 }
		};
		beginDrag(interaction, { referenceLayerUnderlay: rotated });
		interaction.updateDrag({
			pointerId: 1,
			clientX: 30,
			clientY: 10,
			localX: 30,
			localY: 10,
			scaledCanvasPixel: 10
		});

		// Same scale → the swapped 2×4 box shifts to the draft origin, staying rotated.
		expect(interaction.displayedUnderlay(rotated)).toMatchObject({
			placement: { x: 3, y: 0, scale: 2, rotation: 1 },
			projectedBounds: { minX: 3, minY: 0, maxX: 5, maxY: 4 }
		});
	});

	it('clamps corner scaling to an 8x8 document-pixel footprint', () => {
		const interaction = createReferenceLayerPlacementInteraction();
		beginDrag(interaction, {
			handle: 'se',
			canMoveBody: false,
			referenceLayerUnderlay: largeSquareReferenceLayerUnderlay
		});

		interaction.updateDrag({
			pointerId: 1,
			clientX: -90,
			clientY: -80,
			localX: -90,
			localY: -80,
			scaledCanvasPixel: 10
		});

		expect(interaction.commitDrag(1)).toEqual({ x: 1, y: 1, scale: 2 });
	});

	it('accumulates repeated keyboard nudges through the draft placement', () => {
		const interaction = createReferenceLayerPlacementInteraction();

		expect(
			interaction.nudge({
				code: 'ArrowRight',
				shiftKey: false,
				ctrlKey: false,
				metaKey: false,
				altKey: false,
				isKeyboardTarget: true,
				referenceLayerUnderlay,
				isReferenceLayerActive: true
			})
		).toEqual({ x: 1.5, y: 1, scale: 2 });

		expect(
			interaction.nudge({
				code: 'ArrowRight',
				shiftKey: false,
				ctrlKey: false,
				metaKey: false,
				altKey: false,
				isKeyboardTarget: true,
				referenceLayerUnderlay,
				isReferenceLayerActive: true
			})
		).toEqual({ x: 2.5, y: 1, scale: 2 });
	});

	it('keeps a draft nudge until the committed placement catches up', () => {
		const interaction = createReferenceLayerPlacementInteraction();
		interaction.nudge({
			code: 'ArrowRight',
			shiftKey: false,
			ctrlKey: false,
			metaKey: false,
			altKey: false,
			isKeyboardTarget: true,
			referenceLayerUnderlay,
			isReferenceLayerActive: true
		});

		expect(interaction.displayedUnderlay(referenceLayerUnderlay)?.placement).toEqual({
			x: 1.5,
			y: 1,
			scale: 2
		});

		interaction.reconcileCommittedPlacement(referenceLayerUnderlay);
		expect(interaction.displayedUnderlay(referenceLayerUnderlay)?.placement).toEqual({
			x: 1.5,
			y: 1,
			scale: 2
		});

		interaction.reconcileCommittedPlacement({
			...referenceLayerUnderlay,
			placement: { x: 1.5, y: 1, scale: 2 }
		});
		expect(interaction.displayedUnderlay(referenceLayerUnderlay)?.placement).toEqual(
			referenceLayerUnderlay.placement
		);
	});

	it('cancels a touch drag and returns the last local point for gesture forwarding', () => {
		const interaction = createReferenceLayerPlacementInteraction();
		beginDrag(interaction, { pointerType: 'touch' });

		interaction.updateDrag({
			pointerId: 1,
			clientX: 30,
			clientY: 10,
			localX: 7,
			localY: 8,
			scaledCanvasPixel: 10
		});

		expect(interaction.cancelActiveTouchDrag()).toEqual({
			pointerId: 1,
			localX: 7,
			localY: 8
		});
		expect(interaction.commitDrag(1)).toBeNull();
	});
});
