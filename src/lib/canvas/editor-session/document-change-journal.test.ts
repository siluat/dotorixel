import { describe, expect, it, vi } from 'vitest';
import type { Document, MarqueeRegion, ResizeAnchor } from '../canvas-model';
import type { HistoryManager } from '../adapter-types';
import { clearActiveLayerPixels, singleLayerDocument } from '../wasm-backend';
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

function createFakeHistoryManager(
	events: string[],
	opts: { undoDocument?: Document; redoDocument?: Document } = {}
): HistoryManager {
	let canUndo = false;
	let canRedo = false;
	return {
		can_undo: () => canUndo,
		can_redo: () => canRedo,
		clear: () => {
			events.push('history-clear');
			canUndo = false;
			canRedo = false;
		},
		push_snapshot: () => {
			events.push('legacy-snapshot');
			canUndo = true;
			canRedo = false;
		},
		undo: () => undefined,
		redo: () => undefined,
		push_document: () => {
			events.push('snapshot');
			canUndo = true;
			canRedo = false;
		},
		undo_document: (current) => {
			events.push(`undo:${current.width}x${current.height}`);
			if (!opts.undoDocument) return undefined;
			canUndo = false;
			canRedo = true;
			return opts.undoDocument;
		},
		redo_document: (current) => {
			events.push(`redo:${current.width}x${current.height}`);
			if (!opts.redoDocument) return undefined;
			canUndo = true;
			canRedo = false;
			return opts.redoDocument;
		}
	};
}

function createJournal(
	events: string[],
	document: Document,
	overrides: Partial<DocumentChangeJournalDeps> = {}
): DocumentChangeJournal {
	return new DocumentChangeJournal({
		getDocument: () => document,
		replaceDocument: (nextDocument) =>
			events.push(`replace:${nextDocument.width}x${nextDocument.height}`),
		createHistoryManager: () => createFakeHistoryManager(events),
		createLayerId: () => 'layer-2',
		rememberReferenceLayerBlob: (layerId) => events.push(`remember:${layerId}`),
		clearActiveLayerPixels: () => events.push('clear-active-layer'),
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
	it('captures undo snapshots and exposes history availability', () => {
		const events: string[] = [];
		const document = createFakeDocument(events);
		const journal = createJournal(events, document);

		expect(journal.canUndo).toBe(false);
		expect(journal.canRedo).toBe(false);

		journal.captureUndoSnapshot();

		expect(journal.canUndo).toBe(true);
		expect(journal.canRedo).toBe(false);
		expect(events).toEqual(['snapshot']);
	});

	it('restores undo and redo documents through the journal follow-up sequence', () => {
		const events: string[] = [];
		const initial = { width: 16, height: 16 } as unknown as Document;
		const previous = { width: 8, height: 8 } as unknown as Document;
		const next = { width: 32, height: 24 } as unknown as Document;
		let current = initial;
		const history = createFakeHistoryManager(events, {
			undoDocument: previous,
			redoDocument: next
		});
		const journal = createJournal(events, initial, {
			getDocument: () => current,
			replaceDocument: (document) => {
				current = document;
				events.push(`replace:${document.width}x${document.height}`);
			},
			createHistoryManager: () => history
		});
		journal.captureUndoSnapshot();

		expect(journal.undo()).toEqual({ changed: true });
		expect(current).toBe(previous);
		expect(journal.canUndo).toBe(false);
		expect(journal.canRedo).toBe(true);

		expect(journal.redo()).toEqual({ changed: true });
		expect(current).toBe(next);
		expect(journal.canUndo).toBe(true);
		expect(journal.canRedo).toBe(false);
		expect(events).toEqual([
			'snapshot',
			'undo:16x16',
			'replace:8x8',
			'sync',
			'reclamp',
			'render',
			'dirty',
			'redo:8x8',
			'replace:32x24',
			'sync',
			'reclamp',
			'render',
			'dirty'
		]);
	});

	it('skips follow-up effects when undo has no restored document', () => {
		const events: string[] = [];
		const document = createFakeDocument(events);
		const journal = createJournal(events, document);

		expect(journal.undo()).toEqual({ changed: false });
		expect(events).toEqual(['undo:16x16']);
	});

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
			'reclamp',
			'render',
			'dirty'
		]);
	});

	it('applies undoable marquee changes without viewport reclamp', () => {
		const events: string[] = [];
		const region = { x: 1, y: 2, width: 3, height: 4 } as MarqueeRegion;
		const document = {
			width: 16,
			height: 16,
			marquee: () => undefined,
			set_marquee: (next: MarqueeRegion | null | undefined) =>
				events.push(`marquee:${next?.x ?? 'none'}`)
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'set-marquee', region }
		});

		expect(result).toEqual({ changed: true });
		expect(events).toEqual(['snapshot', 'marquee:1', 'render', 'dirty']);
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

	it('clears the active layer as an undoable document change', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(16 * 16 * 4);
		pixels.set([0, 0, 0, 255], 0);
		const document = singleLayerDocument(16, 16, pixels);
		const journal = createJournal(events, document, { clearActiveLayerPixels });

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'clear-active-layer' }
		});

		expect(result).toEqual({ changed: true });
		expect(Array.from(document.layer_pixels_at(0)!.slice(0, 4))).toEqual([0, 0, 0, 0]);
		expect(events).toEqual(['snapshot', 'render', 'dirty']);
	});

	it('applies reorder changes without reclamping unchanged navigation bounds', () => {
		const events: string[] = [];
		const ids = ['layer-1', 'layer-2'];
		const document = {
			width: 16,
			height: 16,
			layer_count: () => ids.length,
			layer_id_at: (index: number) => ids[index],
			layer_kind_at: () => 'pixel',
			reorder_layer: (id: string, index: number) => events.push(`reorder:${id}:${index}`)
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'reorder-layer', id: 'layer-2', newVisualIndex: 1 }
		});

		expect(result).toEqual({ changed: true });
		expect(events).toEqual(['snapshot', 'reorder:layer-2:0', 'render', 'dirty']);
	});

	it('applies active-layer changes without an undo snapshot or metric sync', () => {
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
		expect(events).toEqual(['active:layer-2', 'reclamp', 'render', 'dirty']);
	});

	it('applies timeline collapsed changes without metric sync or viewport reclamp', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			is_timeline_panel_collapsed: () => false,
			set_timeline_panel_collapsed: (collapsed: boolean) => events.push(`timeline:${collapsed}`)
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'persisted-document-ui',
			intent: { type: 'set-timeline-panel-collapsed', collapsed: true }
		});

		expect(result).toEqual({ changed: true });
		expect(events).toEqual(['timeline:true', 'render', 'dirty']);
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
