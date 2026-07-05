// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
	normalizedQuarterTurn,
	referenceLayerUnderlayDocumentRect,
	referenceLayerUnderlaySourceCoords,
	referenceLayerUnderlayViewportRect,
	type ReferenceLayerUnderlay
} from './reference-layer-underlay';
import type { ViewportData } from './viewport';

const SOURCE_RGBA = new Uint8Array([
	255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255
]);

const viewport: ViewportData = {
	pixelSize: 10,
	zoom: 1,
	panX: 3.2,
	panY: 4.6,
	showGrid: false,
	gridColor: '#000000',
	showOnionSkin: false
};

describe('normalizedQuarterTurn', () => {
	it('passes through the four canonical quarter-turns', () => {
		expect([0, 1, 2, 3].map(normalizedQuarterTurn)).toEqual([0, 1, 2, 3]);
	});

	it('treats absence as no rotation', () => {
		expect(normalizedQuarterTurn(undefined)).toBe(0);
	});

	it('wraps out-of-range turns into 0..=3', () => {
		expect(normalizedQuarterTurn(4)).toBe(0);
		expect(normalizedQuarterTurn(7)).toBe(3);
		expect(normalizedQuarterTurn(-1)).toBe(3);
	});

	it('truncates a corrupt fractional value to an integer turn', () => {
		expect(normalizedQuarterTurn(1.5)).toBe(1);
		expect(normalizedQuarterTurn(Number.NaN)).toBe(0);
	});
});

describe('Reference Layer Underlay projection helpers', () => {
	const underlay: ReferenceLayerUnderlay = {
		sourceKey: 'reference',
		sourceRgba: SOURCE_RGBA,
		naturalWidth: 4,
		naturalHeight: 1,
		placement: { x: 0.5, y: 1, scale: 2, rotation: 0 },
		projectedBounds: { minX: 0.5, minY: 1, maxX: 8.5, maxY: 3 },
		opacity: 1
	};

	it('maps document coordinates into source-image coordinates', () => {
		expect(referenceLayerUnderlaySourceCoords(underlay, { x: 6, y: 1 })).toEqual({
			x: 2,
			y: 0
		});
		expect(referenceLayerUnderlaySourceCoords(underlay, { x: 5.9, y: 1 })).toEqual({
			x: 2,
			y: 0
		});
	});

	it('projects a document-space rect for drawing inside a translated renderer context', () => {
		expect(referenceLayerUnderlayDocumentRect(underlay, viewport)).toEqual({
			left: 5,
			top: 10,
			width: 80,
			height: 20
		});
	});

	it('projects a viewport-space rect for placement UI', () => {
		expect(referenceLayerUnderlayViewportRect(underlay, viewport)).toEqual({
			left: 8,
			top: 15,
			width: 80,
			height: 20
		});
	});

	describe('with a quarter-turn rotation', () => {
		// A 2×1 source rotated one quarter-turn clockwise; its projected bounding
		// box turns into a 1×2 column at scale 1 (the swap is computed by the core
		// footprint authority and carried on `projectedBounds`).
		const rotated: ReferenceLayerUnderlay = {
			sourceKey: 'rotated',
			sourceRgba: new Uint8Array([0, 0, 0, 255, 1, 0, 0, 255]),
			naturalWidth: 2,
			naturalHeight: 1,
			placement: { x: 0, y: 0, scale: 1, rotation: 1 },
			projectedBounds: { minX: 0, minY: 0, maxX: 1, maxY: 2 },
			opacity: 1
		};

		it('projects the document rect from the rotated bounds for an odd quarter-turn', () => {
			expect(referenceLayerUnderlayDocumentRect(rotated, viewport)).toEqual({
				left: 0,
				top: 0,
				width: 10, // (maxX - minX) * pixelSize
				height: 20 // (maxY - minY) * pixelSize
			});
		});

		it('inverts the quarter-turn when mapping document to source coordinates', () => {
			// The rotated column reads top→bottom as the source row left→right.
			expect(referenceLayerUnderlaySourceCoords(rotated, { x: 0, y: 0 })).toEqual({
				x: 0,
				y: 0
			});
			expect(referenceLayerUnderlaySourceCoords(rotated, { x: 0, y: 1 })).toEqual({
				x: 1,
				y: 0
			});
		});
	});
});
