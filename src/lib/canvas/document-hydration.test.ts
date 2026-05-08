// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createHistoryManager, documentFromSchemaV3 } from './wasm-backend';
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

describe('documentFromSchemaV3', () => {
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

		const doc = documentFromSchemaV3(schema);

		expect(doc.width).toBe(2);
		expect(doc.height).toBe(2);
		expect(doc.layer_count()).toBe(2);
		expect(doc.layer_id_at(0)).toBe(bottomId);
		expect(doc.layer_id_at(1)).toBe(topId);
		expect(doc.layer_visible_at(1)).toBe(false);
		expect(doc.layer_opacity_at(1)).toBeCloseTo(0.5);
		expect(doc.active_layer_id()).toBe(topId);
		expect(doc.next_layer_number()).toBe(7);
		expect(doc.is_timeline_panel_collapsed()).toBe(true);
		// Pixel preservation, layer 0.
		expect(Array.from(doc.layer_pixels_at(0)!)).toEqual(Array.from(redPixels));
		// Layer 1 was transparent and hidden — composite should equal layer 0.
		expect(Array.from(doc.composite())).toEqual(Array.from(redPixels));
	});
});

describe('HistoryManager document path', () => {
	it('push, undo, redo round-trip the Document state', () => {
		const initial = documentFromSchemaV3(makeSchema());
		const mutated = documentFromSchemaV3(
			makeSchema({ nextLayerNumber: 99, timelinePanelCollapsed: true })
		);
		const history = createHistoryManager();

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
