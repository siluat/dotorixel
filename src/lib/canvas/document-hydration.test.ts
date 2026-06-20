// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createDocumentHistory, documentFromLayerSource } from './wasm-backend';
import type { DocumentSchemaV3 } from '$lib/session/session-storage-types';

function makeSchema(overrides: Partial<DocumentSchemaV3> = {}): DocumentSchemaV3 {
	const layerId = crypto.randomUUID();
	return {
		schemaVersion: 3,
		id: 'doc-1',
		name: 'doc',
		width: 2,
		height: 2,
		layers: [
			{
				id: layerId,
				name: 'Layer 1',
				pixels: new Uint8Array(2 * 2 * 4),
				visible: true,
				opacity: 1
			}
		],
		activeLayerId: layerId,
		nextLayerNumber: 2,
		timelinePanelCollapsed: false,
		saved: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	};
}

describe('documentFromLayerSource', () => {
	it('round-trips a multi-layer schema into a Document with matching pixels', () => {
		const bottomId = crypto.randomUUID();
		const topId = crypto.randomUUID();
		const redPixels = new Uint8Array(2 * 2 * 4);
		for (let i = 0; i < 4; i++) {
			redPixels[i * 4] = 255;
			redPixels[i * 4 + 3] = 255;
		}
		const transparent = new Uint8Array(2 * 2 * 4);

		const schema = makeSchema({
			width: 2,
			height: 2,
			layers: [
				{ id: bottomId, name: 'Bottom', pixels: redPixels, visible: true, opacity: 1 },
				{ id: topId, name: 'Top', pixels: transparent, visible: false, opacity: 0.5 }
			],
			activeLayerId: topId,
			nextLayerNumber: 7,
			timelinePanelCollapsed: true
		});

		const doc = documentFromLayerSource(schema);

		expect(doc.width).toBe(2);
		expect(doc.height).toBe(2);
		expect(doc.layer_count()).toBe(2);
		expect(doc.layers_metadata()[0].id).toBe(bottomId);
		expect(doc.layers_metadata()[1].id).toBe(topId);
		expect(doc.layers_metadata()[1].visible).toBe(false);
		expect(doc.layers_metadata()[1].opacity).toBeCloseTo(0.5);
		expect(doc.active_layer_id()).toBe(topId);
		expect(doc.next_layer_number()).toBe(7);
		expect(doc.is_timeline_panel_collapsed()).toBe(true);
		// Pixel preservation, layer 0.
		expect(Array.from(doc.layer_pixels_at(0)!)).toEqual(Array.from(redPixels));
		// Layer 1 was transparent and hidden — composite should equal layer 0.
		expect(Array.from(doc.composite())).toEqual(Array.from(redPixels));
	});

	it('hydrates a mixed Pixel and Reference layer stack with placement metadata intact', () => {
		const pixelId = crypto.randomUUID();
		const referenceId = crypto.randomUUID();
		const pixels = new Uint8Array(2 * 2 * 4);
		pixels[0] = 255;
		pixels[3] = 255;
		const sourceRgba = new Uint8Array([
			10, 20, 30, 255,
			40, 50, 60, 255
		]);
		const sourceBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

		const doc = documentFromLayerSource({
			width: 2,
			height: 2,
			layers: [
				{
					kind: 'pixel',
					id: pixelId,
					name: 'Paint',
					pixels,
					visible: true,
					opacity: 1
				},
				{
					kind: 'reference',
					id: referenceId,
					name: 'Reference',
					visible: false,
					opacity: 0.5,
					sourceBlob,
					sourceRgba,
					naturalWidth: 2,
					naturalHeight: 1,
					placement: { x: 3, y: 4, scale: 2 }
				}
			],
			activeLayerId: referenceId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: true
		});

		expect(doc.layer_count()).toBe(2);
		expect(doc.layers_metadata()[0].kind).toBe('reference');
		expect(doc.layers_metadata()[1].kind).toBe('pixel');
		expect(doc.layers_metadata()[0].id).toBe(referenceId);
		expect(doc.layers_metadata()[0].visible).toBe(false);
		expect(doc.layers_metadata()[0].opacity).toBeCloseTo(0.5);
		expect(doc.layer_source_pixels_at(0)).toEqual(sourceRgba);
		expect(doc.layers_metadata()[0].natural_width).toBe(2);
		expect(doc.layers_metadata()[0].natural_height).toBe(1);
		const placement = doc.layers_metadata()[0].placement!;
		expect(placement.x).toBe(3);
		expect(placement.y).toBe(4);
		expect(placement.scale).toBe(2);
		expect(doc.active_layer_id()).toBe(referenceId);
		expect(doc.is_timeline_panel_collapsed()).toBe(true);
	});
});

describe('documentFromLayerSource — multi-frame', () => {
	function fill2x2(r: number, g: number, b: number): Uint8Array {
		const px = new Uint8Array(2 * 2 * 4);
		for (let i = 0; i < 4; i++) {
			px[i * 4] = r;
			px[i * 4 + 1] = g;
			px[i * 4 + 2] = b;
			px[i * 4 + 3] = 255;
		}
		return px;
	}

	it('reconstructs a document with one cel per frame, preserving each frame’s pixels and the active frame', () => {
		const layerId = crypto.randomUUID();
		const frameA = crypto.randomUUID();
		const frameB = crypto.randomUUID();
		const red = fill2x2(255, 0, 0);
		const blue = fill2x2(0, 0, 255);

		const doc = documentFromLayerSource({
			width: 2,
			height: 2,
			frames: [{ id: frameA }, { id: frameB }],
			activeFrameId: frameB,
			layers: [
				{
					kind: 'pixel',
					id: layerId,
					name: 'Layer 1',
					cels: [
						{ frameId: frameA, pixels: red },
						{ frameId: frameB, pixels: blue }
					],
					visible: true,
					opacity: 1
				}
			],
			activeLayerId: layerId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false
		});

		expect(doc.frame_count()).toBe(2);
		// The first frame's id is reassigned by the builder, so assert on per-position
		// cel content (the durable contract), not on id identity.
		const frames = doc.frames_metadata();
		expect(Array.from(doc.cel_pixels_at(0, frames[0].id)!)).toEqual(Array.from(red));
		expect(Array.from(doc.cel_pixels_at(0, frames[1].id)!)).toEqual(Array.from(blue));
		// Active frame is the second one (frame-b → blue), so the composite is blue.
		expect(doc.active_frame_id()).toBe(frames[1].id);
		expect(Array.from(doc.composite())).toEqual(Array.from(blue));
	});

	it('preserves a multi-frame stack’s per-layer cels independently', () => {
		const bottom = crypto.randomUUID();
		const top = crypto.randomUUID();
		const f1 = crypto.randomUUID();
		const f2 = crypto.randomUUID();
		const red = fill2x2(255, 0, 0);
		const green = fill2x2(0, 255, 0);
		const blue = fill2x2(0, 0, 255);
		const transparent = new Uint8Array(2 * 2 * 4);

		const doc = documentFromLayerSource({
			width: 2,
			height: 2,
			frames: [{ id: f1 }, { id: f2 }],
			activeFrameId: f1,
			layers: [
				{
					kind: 'pixel',
					id: bottom,
					name: 'Bottom',
					cels: [
						{ frameId: f1, pixels: red },
						{ frameId: f2, pixels: green }
					],
					visible: true,
					opacity: 1
				},
				{
					kind: 'pixel',
					id: top,
					name: 'Top',
					cels: [
						{ frameId: f1, pixels: transparent },
						{ frameId: f2, pixels: blue }
					],
					visible: true,
					opacity: 1
				}
			],
			activeLayerId: bottom,
			nextLayerNumber: 3,
			timelinePanelCollapsed: false
		});

		const frames = doc.frames_metadata();
		// Bottom layer (index 0): red on frame 1, green on frame 2.
		expect(Array.from(doc.cel_pixels_at(0, frames[0].id)!)).toEqual(Array.from(red));
		expect(Array.from(doc.cel_pixels_at(0, frames[1].id)!)).toEqual(Array.from(green));
		// Top layer (index 1): empty on frame 1, blue on frame 2.
		expect(Array.from(doc.cel_pixels_at(1, frames[0].id)!)).toEqual(Array.from(transparent));
		expect(Array.from(doc.cel_pixels_at(1, frames[1].id)!)).toEqual(Array.from(blue));
	});
});

describe('DocumentHistory document path', () => {
	it('push, undo, redo round-trip the Document state', () => {
		const initial = documentFromLayerSource(makeSchema());
		const mutated = documentFromLayerSource(
			makeSchema({ nextLayerNumber: 99, timelinePanelCollapsed: true })
		);
		const history = createDocumentHistory();

		history.push_document(initial);
		const undone = history.undo_document(mutated);

		expect(undone).toBeDefined();
		expect(undone!.next_layer_number()).toBe(2);
		expect(undone!.is_timeline_panel_collapsed()).toBe(false);

		const redone = history.redo_document(undone!);
		expect(redone).toBeDefined();
		expect(redone!.next_layer_number()).toBe(99);
		expect(redone!.is_timeline_panel_collapsed()).toBe(true);
	});
});
