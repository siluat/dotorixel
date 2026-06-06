// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
	referenceLayerUnderlayBounds,
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
	gridColor: '#000000'
};

describe('Reference Layer Underlay projection helpers', () => {
	const underlay: ReferenceLayerUnderlay = {
		sourceKey: 'reference',
		sourceRgba: SOURCE_RGBA,
		naturalWidth: 4,
		naturalHeight: 1,
		placement: { x: 0.5, y: 1, scale: 2 },
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

	it('returns document bounds for navigation clamping', () => {
		expect(referenceLayerUnderlayBounds(underlay)).toEqual({
			minX: 0.5,
			minY: 1,
			maxX: 8.5,
			maxY: 3
		});
	});
});
