// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { documentFromLayerSource, singleLayerDocument } from './wasm-backend';
import {
	ReferenceLayerUnderlayProjector,
	referenceLayerUnderlayBounds,
	referenceLayerUnderlayDocumentRect,
	referenceLayerUnderlaySourceCoords,
	referenceLayerUnderlayViewportRect,
	type ReferenceLayerUnderlay
} from './reference-layer-underlay';
import type { ReferencePlacement } from './canvas-model';
import type { ViewportData } from './viewport';

const SOURCE_RGBA = new Uint8Array([
	255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255
]);

function makeReferenceDocument({
	visible = true,
	opacity = 0.5,
	placement = { x: 0.5, y: 1, scale: 2 }
}: {
	readonly visible?: boolean;
	readonly opacity?: number;
	readonly placement?: ReferencePlacement;
} = {}) {
	const pixelId = crypto.randomUUID();
	const referenceId = crypto.randomUUID();
	const document = documentFromLayerSource({
		width: 8,
		height: 8,
		layers: [
			{
				kind: 'pixel',
				id: pixelId,
				name: 'Paint',
				pixels: new Uint8Array(8 * 8 * 4),
				visible: true,
				opacity: 1
			},
			{
				kind: 'reference',
				id: referenceId,
				name: 'Reference',
				visible,
				opacity,
				sourceBlob: new Blob([SOURCE_RGBA], { type: 'image/png' }),
				sourceRgba: SOURCE_RGBA,
				naturalWidth: 4,
				naturalHeight: 1,
				placement
			}
		],
		activeLayerId: referenceId,
		nextLayerNumber: 2,
		timelinePanelCollapsed: false
	});
	return { document, referenceId };
}

const viewport: ViewportData = {
	pixelSize: 10,
	zoom: 1,
	panX: 3.2,
	panY: 4.6,
	showGrid: false,
	gridColor: '#000000'
};

describe('ReferenceLayerUnderlayProjector', () => {
	it('projects a visible Reference Layer into a Reference Layer Underlay', () => {
		const { document, referenceId } = makeReferenceDocument();
		const projector = new ReferenceLayerUnderlayProjector();

		const underlay = projector.project(document);

		expect(underlay).toMatchObject({
			naturalWidth: 4,
			naturalHeight: 1,
			placement: { x: 0.5, y: 1, scale: 2 },
			opacity: 0.5
		});
		expect(underlay?.sourceKey).toContain(`${referenceId}:4x1:`);
		expect(underlay?.sourceRgba).toEqual(SOURCE_RGBA);
	});

	it('returns undefined when the Document has no Reference Layer', () => {
		const document = singleLayerDocument(8, 8, new Uint8Array(8 * 8 * 4));
		const projector = new ReferenceLayerUnderlayProjector();

		expect(projector.project(document)).toBeUndefined();
	});

	it('returns undefined when the Reference Layer is hidden', () => {
		const { document } = makeReferenceDocument({ visible: false });
		const projector = new ReferenceLayerUnderlayProjector();

		expect(projector.project(document)).toBeUndefined();
	});

	it('reuses source RGBA for the same Document source identity', () => {
		const { document } = makeReferenceDocument();
		const projector = new ReferenceLayerUnderlayProjector();

		const first = projector.project(document)!;
		const second = projector.project(document)!;

		expect(second.sourceRgba).toBe(first.sourceRgba);
		expect(second.sourceKey).toBe(first.sourceKey);
	});

	it('clears cached source RGBA when the underlay becomes unavailable', () => {
		const { document, referenceId } = makeReferenceDocument();
		const projector = new ReferenceLayerUnderlayProjector();
		const sourceSpy = vi.spyOn(document, 'layer_source_pixels_at');

		const first = projector.project(document)!;
		document.set_layer_visibility(referenceId, false);
		expect(projector.project(document)).toBeUndefined();
		document.set_layer_visibility(referenceId, true);
		const second = projector.project(document)!;

		expect(sourceSpy).toHaveBeenCalledTimes(2);
		expect(second.sourceKey).toBe(first.sourceKey);
	});
});

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
