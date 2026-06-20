// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { readDocumentFrameProjection } from './document-frame-projection';
import { documentFromLayerSource } from './wasm-backend';
import type { Color } from './color';

const TRANSPARENT = new Uint8Array(4 * 4 * 4);

function opaqueAt(x: number, y: number, color: Color = { r: 255, g: 0, b: 0, a: 255 }): Uint8Array {
	const pixels = new Uint8Array(4 * 4 * 4);
	const i = (y * 4 + x) * 4;
	pixels[i] = color.r;
	pixels[i + 1] = color.g;
	pixels[i + 2] = color.b;
	pixels[i + 3] = color.a;
	return pixels;
}

function pixelDoc(...pixelLayers: ReadonlyArray<{ id: string; pixels: Uint8Array }>) {
	return documentFromLayerSource({
		width: 4,
		height: 4,
		layers: pixelLayers.map(({ id, pixels }) => ({
			kind: 'pixel' as const,
			id,
			name: id,
			pixels,
			visible: true,
			opacity: 1
		})),
		activeLayerId: pixelLayers[0].id,
		nextLayerNumber: pixelLayers.length + 1,
		timelinePanelCollapsed: false
	});
}

describe('DocumentFrameProjection', () => {
	it('reads frames in axis order and reports the active frame id', () => {
		const document = pixelDoc({ id: crypto.randomUUID(), pixels: TRANSPARENT });
		const firstFrameId = document.active_frame_id();
		const secondFrameId = crypto.randomUUID();
		document.add_frame(secondFrameId); // appended after the active frame; becomes active

		const read = readDocumentFrameProjection(document);

		expect(read.frames.map((f) => f.id)).toEqual([firstFrameId, secondFrameId]);
		expect(read.activeFrameId).toBe(secondFrameId);
	});

	it('marks a cel occupied only when its Pixel Layer holds content', () => {
		const filledId = crypto.randomUUID();
		const emptyId = crypto.randomUUID();
		const document = pixelDoc(
			{ id: filledId, pixels: opaqueAt(1, 1) },
			{ id: emptyId, pixels: TRANSPARENT }
		);

		const [frame] = readDocumentFrameProjection(document).frames;

		expect(frame.occupiedLayerIds.has(filledId)).toBe(true);
		expect(frame.occupiedLayerIds.has(emptyId)).toBe(false);
	});

	it('reports occupancy per frame: a layer filled in one frame is empty in a freshly added frame', () => {
		const layerId = crypto.randomUUID();
		const document = pixelDoc({ id: layerId, pixels: opaqueAt(1, 1) });
		const filledFrameId = document.active_frame_id();
		const emptyFrameId = crypto.randomUUID();
		document.add_frame(emptyFrameId); // transparent cel for the layer

		const { frames } = readDocumentFrameProjection(document);
		const filled = frames.find((f) => f.id === filledFrameId)!;
		const empty = frames.find((f) => f.id === emptyFrameId)!;

		expect(filled.occupiedLayerIds.has(layerId)).toBe(true);
		expect(empty.occupiedLayerIds.has(layerId)).toBe(false);
	});

	it('never reports a Reference Layer as occupied — it is frame-independent and has no cels', () => {
		const pixelId = crypto.randomUUID();
		const referenceId = crypto.randomUUID();
		const document = documentFromLayerSource({
			width: 4,
			height: 4,
			layers: [
				{
					kind: 'pixel',
					id: pixelId,
					name: 'Paint',
					pixels: opaqueAt(0, 0),
					visible: true,
					opacity: 1
				},
				{
					kind: 'reference',
					id: referenceId,
					name: 'Reference',
					visible: true,
					opacity: 1,
					sourceBlob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
					sourceRgba: new Uint8Array([255, 0, 0, 255]),
					naturalWidth: 1,
					naturalHeight: 1,
					placement: { x: 0, y: 0, scale: 1, rotation: 0 }
				}
			],
			activeLayerId: pixelId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false
		});

		const [frame] = readDocumentFrameProjection(document).frames;

		expect(frame.occupiedLayerIds.has(pixelId)).toBe(true);
		expect(frame.occupiedLayerIds.has(referenceId)).toBe(false);
	});
});
