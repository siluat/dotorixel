import { describe, expect, it, vi } from 'vitest';
import type { Document, ResizeAnchor } from '../canvas-model';
import {
	DocumentChangeJournal,
	type DocumentChangeJournalDeps
} from './document-change-journal.svelte';

function createFakeDocument(events: string[]): Document {
	return {
		width: 16,
		height: 16,
		add_layer(id: string, name: string) {
			events.push(`add:${id}:${name}`);
		}
	} as Document;
}

function createJournal(
	events: string[],
	document: Document,
	overrides: Partial<DocumentChangeJournalDeps> = {}
): DocumentChangeJournal {
	return new DocumentChangeJournal({
		getDocument: () => document,
		captureUndoSnapshot: () => events.push('snapshot'),
		createLayerId: () => 'layer-2',
		rememberReferenceLayerBlob: (layerId) => events.push(`remember:${layerId}`),
		resizeDocument: (_document, width, height, anchor) =>
			events.push(`resize:${width}:${height}:${anchor}`),
		syncDocumentMetrics: () => events.push('sync'),
		reclampViewport: () => events.push('reclamp'),
		invalidateRender: () => events.push('render'),
		markDirty: () => events.push('dirty'),
		...overrides
	});
}

describe('DocumentChangeJournal', () => {
	it('applies an undoable add-layer change through the journal sequence', () => {
		const events: string[] = [];
		const document = createFakeDocument(events);
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'add-pixel-layer', name: 'Layer 2' }
		});

		expect(result).toEqual({ changed: true, layerId: 'layer-2' });
		expect(events).toEqual([
			'snapshot',
			'add:layer-2:Layer 2',
			'sync',
			'reclamp',
			'render',
			'dirty'
		]);
	});

	it('does not run follow-up effects when the core Document mutation fails', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			add_layer() {
				events.push('add');
				throw new Error('core failed');
			}
		} as unknown as Document;
		const journal = createJournal(events, document, {
			syncDocumentMetrics: vi.fn(() => events.push('sync')),
			reclampViewport: vi.fn(() => events.push('reclamp')),
			invalidateRender: vi.fn(() => events.push('render')),
			markDirty: vi.fn(() => events.push('dirty'))
		});

		expect(() =>
			journal.commit({
				kind: 'undoable-document',
				intent: { type: 'add-pixel-layer', name: 'Layer 2' }
			})
		).toThrow('core failed');
		expect(events).toEqual(['snapshot', 'add']);
	});

	it('skips undo snapshots and follow-up effects for undoable no-op changes', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			layer_count: () => 1
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'remove-layer', id: 'only-layer' }
		});

		expect(result).toEqual({ changed: false });
		expect(events).toEqual([]);
	});

	it('applies persisted Document UI changes without an undo snapshot', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			active_layer_id: () => 'layer-1',
			set_active_layer: (id: string) => events.push(`active:${id}`)
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'persisted-document-ui',
			intent: { type: 'set-active-layer', id: 'layer-2' }
		});

		expect(result).toEqual({ changed: true });
		expect(events).toEqual(['active:layer-2', 'sync', 'reclamp', 'render', 'dirty']);
	});

	it('skips persisted Document UI no-op changes', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			is_timeline_panel_collapsed: () => false
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'persisted-document-ui',
			intent: { type: 'set-timeline-panel-collapsed', collapsed: false }
		});

		expect(result).toEqual({ changed: false });
		expect(events).toEqual([]);
	});

	it('validates Reference Layer source before capturing an undo snapshot', () => {
		const events: string[] = [];
		const document = createFakeDocument(events);
		const journal = createJournal(events, document);

		expect(() =>
			journal.commit({
				kind: 'undoable-document',
				intent: {
					type: 'set-reference-layer',
					source: {
						name: 'bad.png',
						sourceBlob: new Blob(),
						sourceRgba: new Uint8Array(3),
						naturalWidth: 1,
						naturalHeight: 1
					}
				}
			})
		).toThrow('Reference Layer source RGBA length must match dimensions');
		expect(events).toEqual([]);
	});

	it('sets a Reference Layer and remembers its source blob before follow-up effects', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			add_reference_layer(
				id: string,
				name: string,
				sourceRgba: Uint8Array,
				sourceWidth: number,
				sourceHeight: number
			) {
				events.push(
					`reference:${id}:${name}:${sourceRgba.length}:${sourceWidth}x${sourceHeight}`
				);
			}
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: {
				type: 'set-reference-layer',
				source: {
					name: 'sketch.png',
					sourceBlob: new Blob([new Uint8Array([1])], { type: 'image/png' }),
					sourceRgba: new Uint8Array([10, 20, 30, 255]),
					naturalWidth: 1,
					naturalHeight: 1
				}
			}
		});

		expect(result).toEqual({ changed: true, layerId: 'layer-2' });
		expect(events).toEqual([
			'snapshot',
			'reference:layer-2:sketch.png:4:1x1',
			'remember:layer-2',
			'sync',
			'reclamp',
			'render',
			'dirty'
		]);
	});

	it('routes document resize through the injected resize adapter', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16
		} as unknown as Document;
		let captured: { width: number; height: number; anchor: ResizeAnchor } | undefined;
		const journal = createJournal(events, document, {
			resizeDocument: (_document, width, height, anchor) => {
				captured = { width, height, anchor };
				events.push(`resize:${width}:${height}:${anchor}`);
			}
		});

		const result = journal.commit({
			kind: 'undoable-document',
			intent: {
				type: 'resize-document',
				width: 32,
				height: 24,
				anchor: 'center'
			}
		});

		expect(result).toEqual({ changed: true });
		expect(captured).toEqual({ width: 32, height: 24, anchor: 'center' });
		expect(events).toEqual([
			'snapshot',
			'resize:32:24:center',
			'sync',
			'reclamp',
			'render',
			'dirty'
		]);
	});
});
