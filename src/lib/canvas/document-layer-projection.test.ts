// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { ReferencePlacement } from './canvas-model';
import { DocumentLayerProjection } from './document-layer-projection';
import { documentFromLayerSource, singleLayerDocument } from './wasm-backend';

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
	return { document, pixelId, referenceId };
}

describe('DocumentLayerProjection', () => {
	it('projects layer stack reads and the visible Reference Layer Underlay together', () => {
		const { document, pixelId, referenceId } = makeReferenceDocument();
		const projection = new DocumentLayerProjection();

		const read = projection.read(document);

		expect(read.layersInStackOrder.map((layer) => layer.id)).toEqual([referenceId, pixelId]);
		expect(read.layersInPanelOrder.map((layer) => layer.id)).toEqual([pixelId, referenceId]);
		expect(read.stackIndexById.get(referenceId)).toBe(0);
		expect(read.stackIndexById.get(pixelId)).toBe(1);
		expect(read.layerById.get(referenceId)).toMatchObject({
			id: referenceId,
			name: 'Reference',
			visible: true,
			opacity: 0.5,
			kind: 'reference',
			stackIndex: 0,
			panelIndex: 1
		});
		expect(read.activeLayer?.id).toBe(referenceId);
		expect(read.activeLayerKind).toBe('reference');
		expect(read.referenceLayer?.id).toBe(referenceId);
		expect(read.referenceLayerUnderlay).toMatchObject({
			naturalWidth: 4,
			naturalHeight: 1,
			placement: { x: 0.5, y: 1, scale: 2 },
			opacity: 0.5
		});
		expect(read.referenceLayerUnderlay?.sourceKey).toContain(`${referenceId}:4x1:`);
		expect(read.referenceLayerUnderlay?.sourceRgba).toEqual(SOURCE_RGBA);
	});

	it('returns no Reference Layer underlay when the Document has no Reference Layer', () => {
		const document = singleLayerDocument(8, 8, new Uint8Array(8 * 8 * 4));
		const projection = new DocumentLayerProjection();

		const read = projection.read(document);

		expect(read.referenceLayer).toBeUndefined();
		expect(read.referenceLayerUnderlay).toBeUndefined();
		expect(read.layersInStackOrder).toHaveLength(1);
	});

	it('keeps the Reference Layer read while omitting underlay for hidden sources', () => {
		const { document, referenceId } = makeReferenceDocument({ visible: false });
		const projection = new DocumentLayerProjection();

		const read = projection.read(document);

		expect(read.referenceLayer?.id).toBe(referenceId);
		expect(read.referenceLayerUnderlay).toBeUndefined();
	});

	it('reuses source RGBA for the same Document source identity', () => {
		const { document } = makeReferenceDocument();
		const projection = new DocumentLayerProjection();

		const first = projection.read(document).referenceLayerUnderlay!;
		const second = projection.read(document).referenceLayerUnderlay!;

		expect(second.sourceRgba).toBe(first.sourceRgba);
		expect(second.sourceKey).toBe(first.sourceKey);
	});

	it('clears cached source RGBA when the underlay becomes unavailable', () => {
		const { document, referenceId } = makeReferenceDocument();
		const projection = new DocumentLayerProjection();
		const sourceSpy = vi.spyOn(document, 'layer_source_pixels_at');

		const first = projection.read(document).referenceLayerUnderlay!;
		document.set_layer_visibility(referenceId, false);
		expect(projection.read(document).referenceLayerUnderlay).toBeUndefined();
		document.set_layer_visibility(referenceId, true);
		const second = projection.read(document).referenceLayerUnderlay!;

		expect(sourceSpy).toHaveBeenCalledTimes(2);
		expect(second.sourceKey).toBe(first.sourceKey);
	});
});
