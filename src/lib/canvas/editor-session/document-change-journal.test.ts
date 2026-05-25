import { describe, expect, it, vi } from 'vitest';
import type { Document } from '../canvas-model';
import { DocumentChangeJournal } from './document-change-journal.svelte';

function createFakeDocument(events: string[]): Document {
	return {
		add_layer(id: string, name: string) {
			events.push(`add:${id}:${name}`);
		}
	} as Document;
}

describe('DocumentChangeJournal', () => {
	it('applies an undoable add-layer change through the journal sequence', () => {
		const events: string[] = [];
		const document = createFakeDocument(events);
		const journal = new DocumentChangeJournal({
			getDocument: () => document,
			captureUndoSnapshot: () => events.push('snapshot'),
			createLayerId: () => 'layer-2',
			syncDocumentMetrics: () => events.push('sync'),
			reclampViewport: () => events.push('reclamp'),
			invalidateRender: () => events.push('render'),
			markDirty: () => events.push('dirty')
		});

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
			add_layer() {
				events.push('add');
				throw new Error('core failed');
			}
		} as unknown as Document;
		const journal = new DocumentChangeJournal({
			getDocument: () => document,
			captureUndoSnapshot: () => events.push('snapshot'),
			createLayerId: () => 'layer-2',
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
});
