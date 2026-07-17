import { describe, expect, it, vi } from 'vitest';
import type { Document, MarqueeRegion, ResizeAnchor } from '../canvas-model';
import type { DocumentHistory } from '../adapter-types';
import type { DocumentLayerProjectionRead } from '../document-layer-projection';
import {
	clearActiveLayerPixels,
	createDocumentHistory,
	documentFromLayerSource,
	marqueeRegionFromDrag,
	singleLayerDocument
} from '../wasm-backend';
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

/**
 * Stands in for the core ring so journal tests can drive the wiring around it.
 * `endEditCommits` plays the verdict the core would reach by comparison — the
 * comparison itself is the ring's job (tested in Rust), and the no-op
 * invariant it decides is covered here against the real history instead.
 */
function createFakeDocumentHistory(
	events: string[],
	opts: {
		undoDocument?: Document;
		redoDocument?: Document;
		endEditCommits?: boolean;
	} = {}
): DocumentHistory {
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
		push_document: () => {
			events.push('snapshot');
			canUndo = true;
			canRedo = false;
		},
		begin_edit: () => {
			events.push('begin-edit');
		},
		end_edit: () => {
			events.push('end-edit');
			const committed = opts.endEditCommits ?? true;
			if (committed) {
				canUndo = true;
				canRedo = false;
			}
			return committed;
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

function createTestLayerProjection(document: Document): DocumentLayerProjectionRead {
	const records =
		typeof document.layers_metadata === 'function' ? document.layers_metadata() : [];
	const activeLayerId =
		typeof document.active_layer_id === 'function' ? document.active_layer_id() : undefined;
	const count = records.length;
	const stackLayers = records.map((record, stackIndex) => ({
		id: record.id,
		name: record.name,
		visible: record.visible,
		opacity: record.opacity,
		kind: record.kind === 'reference' ? ('reference' as const) : ('pixel' as const),
		stackIndex,
		panelIndex: count - 1 - stackIndex
	}));
	const layersInPanelOrder = stackLayers.slice().reverse();
	const layerById = new Map(stackLayers.map((layer) => [layer.id, layer]));
	const stackIndexById = new Map(stackLayers.map((layer) => [layer.id, layer.stackIndex]));
	const activeLayer = activeLayerId ? layerById.get(activeLayerId) : undefined;
	return {
		layersInStackOrder: stackLayers,
		layersInPanelOrder,
		layerById,
		stackIndexById,
		activeLayer,
		activeLayerKind: activeLayer?.kind,
		isActiveLayerEditable: activeLayer?.kind !== 'reference',
		referenceLayer: stackLayers.find((layer) => layer.kind === 'reference')
	};
}

function createJournal(
	events: string[],
	document: Document,
	overrides: Partial<DocumentChangeJournalDeps> = {}
): DocumentChangeJournal {
	const getDocument = overrides.getDocument ?? (() => document);
	return new DocumentChangeJournal({
		getDocument,
		getLayerProjection: () => createTestLayerProjection(getDocument()),
		replaceDocument: (nextDocument) =>
			events.push(`replace:${nextDocument.width}x${nextDocument.height}`),
		createDocumentHistory: () => createFakeDocumentHistory(events),
		createLayerId: () => 'layer-2',
		createFrameId: () => 'frame-2',
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

function getPixelAt(document: Document, x: number, y: number): readonly number[] {
	return getLayerPixelAt(document, 0, x, y);
}

function getLayerPixelAt(
	document: Document,
	layerIndex: number,
	x: number,
	y: number
): readonly number[] {
	const start = (y * document.width + x) * 4;
	return Array.from(document.layer_pixels_at(layerIndex)!.slice(start, start + 4));
}

describe('DocumentChangeJournal', () => {
	it('routes stroke begin/end to the history Edit Baseline seam', () => {
		const events: string[] = [];
		const document = createFakeDocument(events);
		const journal = createJournal(events, document);

		journal.beginEdit();
		journal.endEdit();

		// The no-op decision itself lives in the core ring (tested in Rust);
		// the journal only marks the stroke boundaries.
		expect(events).toEqual(['begin-edit', 'end-edit']);
	});

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
		const history = createFakeDocumentHistory(events, {
			undoDocument: previous,
			redoDocument: next
		});
		const journal = createJournal(events, initial, {
			getDocument: () => current,
			replaceDocument: (document) => {
				current = document;
				events.push(`replace:${document.width}x${document.height}`);
			},
			createDocumentHistory: () => history
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
			active_layer_id: () => 'layer-1',
			layer_count: () => 1,
			layers_metadata: () => [
				{ id: 'layer-1', name: 'Layer 1', visible: true, opacity: 1, kind: 'pixel' }
			],
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

	it.each([
		[
			'define',
			undefined,
			{ x: 1, y: 2, width: 3, height: 4 } as MarqueeRegion
		],
		[
			'clear',
			{ x: 1, y: 2, width: 3, height: 4 } as MarqueeRegion,
			null
		]
	])('skips Marquee %s on a Reference-active document', (_case, current, next) => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			active_layer_id: () => 'reference-1',
			marquee: () => current,
			set_marquee: () => events.push('marquee'),
			layer_count: () => 1,
			layers_metadata: () => [
				{ id: 'reference-1', name: 'Reference', visible: true, opacity: 1, kind: 'reference' }
			]
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'set-marquee', region: next }
		});

		expect(result).toEqual({ changed: false });
		expect(events).toEqual([]);
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

	it('clears Marquee pixels with one undo snapshot and preserves the Marquee', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(4 * 4 * 4);
		pixels.set([255, 0, 0, 255], 0);
		pixels.set([0, 255, 0, 255], (1 * 4 + 1) * 4);
		const document = singleLayerDocument(4, 4, pixels);
		const marquee = marqueeRegionFromDrag(1, 1, 2, 2);
		document.set_marquee(marquee);
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'clear-marquee-pixels' }
		});

		expect(result).toEqual({ changed: true });
		expect(Array.from(document.layer_pixels_at(0)!.slice(0, 4))).toEqual([255, 0, 0, 255]);
		expect(Array.from(document.layer_pixels_at(0)!.slice((1 * 4 + 1) * 4, (1 * 4 + 2) * 4))).toEqual([
			0, 0, 0, 0
		]);
		expect(document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 2 });
		expect(events).toEqual(['snapshot', 'render', 'dirty']);
	});

	it('undo restores pixels cleared through the Marquee', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(4 * 4 * 4);
		pixels.set([0, 255, 0, 255], (1 * 4 + 1) * 4);
		let current = singleLayerDocument(4, 4, pixels);
		current.set_marquee(marqueeRegionFromDrag(1, 1, 1, 1));
		const journal = createJournal(events, current, {
			getDocument: () => current,
			replaceDocument: (document) => {
				current = document;
				events.push(`replace:${document.width}x${document.height}`);
			},
			createDocumentHistory
		});

		journal.commit({
			kind: 'undoable-document',
			intent: { type: 'clear-marquee-pixels' }
		});
		expect(Array.from(current.layer_pixels_at(0)!.slice((1 * 4 + 1) * 4, (1 * 4 + 2) * 4))).toEqual([
			0, 0, 0, 0
		]);

		expect(journal.undo()).toEqual({ changed: true });

		expect(Array.from(current.layer_pixels_at(0)!.slice((1 * 4 + 1) * 4, (1 * 4 + 2) * 4))).toEqual([
			0, 255, 0, 255
		]);
		expect(current.marquee()).toMatchObject({ x: 1, y: 1, width: 1, height: 1 });
	});

	it('flips the Marquee region horizontally as one undoable document change', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(2 * 1 * 4);
		pixels.set([255, 0, 0, 255], 0);
		pixels.set([0, 255, 0, 255], 4);
		const document = singleLayerDocument(2, 1, pixels);
		document.set_marquee(marqueeRegionFromDrag(0, 0, 1, 0));
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'flip-marquee-horizontal' }
		});

		expect(result).toEqual({ changed: true });
		expect(Array.from(document.layer_pixels_at(0)!.slice(0, 4))).toEqual([0, 255, 0, 255]);
		expect(Array.from(document.layer_pixels_at(0)!.slice(4, 8))).toEqual([255, 0, 0, 255]);
		expect(events).toEqual(['snapshot', 'render', 'dirty']);
	});

	it('undo restores and redo re-applies a marquee flip', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(2 * 1 * 4);
		pixels.set([255, 0, 0, 255], 0);
		pixels.set([0, 255, 0, 255], 4);
		let current = singleLayerDocument(2, 1, pixels);
		current.set_marquee(marqueeRegionFromDrag(0, 0, 1, 0));
		const journal = createJournal(events, current, {
			getDocument: () => current,
			replaceDocument: (document) => {
				current = document;
				events.push(`replace:${document.width}x${document.height}`);
			},
			createDocumentHistory
		});

		journal.commit({ kind: 'undoable-document', intent: { type: 'flip-marquee-horizontal' } });
		expect(Array.from(current.layer_pixels_at(0)!.slice(0, 4))).toEqual([0, 255, 0, 255]);

		expect(journal.undo()).toEqual({ changed: true });
		expect(Array.from(current.layer_pixels_at(0)!.slice(0, 4))).toEqual([255, 0, 0, 255]);
		expect(Array.from(current.layer_pixels_at(0)!.slice(4, 8))).toEqual([0, 255, 0, 255]);

		expect(journal.redo()).toEqual({ changed: true });
		expect(Array.from(current.layer_pixels_at(0)!.slice(0, 4))).toEqual([0, 255, 0, 255]);
	});

	it('skips a marquee flip and captures no snapshot when the active layer is Reference', () => {
		const events: string[] = [];
		// A Marquee is present, so the Reference-active layer is what makes
		// this a no-op.
		const document = {
			width: 16,
			height: 16,
			active_layer_id: () => 'reference-1',
			layer_count: () => 1,
			marquee: () => ({ x: 0, y: 0, width: 4, height: 4 }),
			layers_metadata: () => [
				{ id: 'reference-1', name: 'Reference', visible: true, opacity: 1, kind: 'reference' }
			]
		} as unknown as Document;
		const journal = createJournal(events, document);

		expect(
			journal.commit({ kind: 'undoable-document', intent: { type: 'flip-marquee-horizontal' } })
		).toEqual({ changed: false });
		expect(
			journal.commit({ kind: 'undoable-document', intent: { type: 'flip-marquee-vertical' } })
		).toEqual({ changed: false });
		expect(events).toEqual([]);
	});

	it('skips a marquee flip and captures no snapshot without a Marquee', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(2 * 1 * 4);
		pixels.set([255, 0, 0, 255], 0);
		const document = singleLayerDocument(2, 1, pixels);
		const journal = createJournal(events, document);

		expect(
			journal.commit({ kind: 'undoable-document', intent: { type: 'flip-marquee-horizontal' } })
		).toEqual({ changed: false });
		expect(
			journal.commit({ kind: 'undoable-document', intent: { type: 'flip-marquee-vertical' } })
		).toEqual({ changed: false });
		// The Document is untouched: no undo entry, no dirty mark, no mirror.
		expect(events).toEqual([]);
		expect(Array.from(document.layer_pixels_at(0)!.slice(0, 4))).toEqual([255, 0, 0, 255]);
	});

	it('skips a canvas flip and captures no snapshot on a Reference-only document', () => {
		const events: string[] = [];
		// The last Pixel Layer can be removed while a Reference Layer remains,
		// so a Reference-only document is reachable. With no Marquee either, a
		// canvas flip has nothing to mirror — it must not snapshot or dirty.
		const document = {
			width: 16,
			height: 16,
			active_layer_id: () => 'reference-1',
			layer_count: () => 1,
			marquee: () => undefined,
			layers_metadata: () => [
				{ id: 'reference-1', name: 'Reference', visible: true, opacity: 1, kind: 'reference' }
			]
		} as unknown as Document;
		const journal = createJournal(events, document);

		expect(
			journal.commit({ kind: 'undoable-document', intent: { type: 'flip-canvas-horizontal' } })
		).toEqual({ changed: false });
		expect(
			journal.commit({ kind: 'undoable-document', intent: { type: 'flip-canvas-vertical' } })
		).toEqual({ changed: false });
		expect(events).toEqual([]);
	});

	it('flips the whole canvas horizontally as one undoable document change', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(2 * 1 * 4);
		pixels.set([255, 0, 0, 255], 0);
		pixels.set([0, 255, 0, 255], 4);
		const document = singleLayerDocument(2, 1, pixels);
		document.set_marquee(marqueeRegionFromDrag(0, 0, 0, 0));
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'flip-canvas-horizontal' }
		});

		expect(result).toEqual({ changed: true });
		// The whole canvas mirrors — a Marquee never switches it to region
		// mode — and the Marquee follows the same mapping onto x = 1.
		expect(Array.from(document.layer_pixels_at(0)!.slice(0, 4))).toEqual([0, 255, 0, 255]);
		expect(Array.from(document.layer_pixels_at(0)!.slice(4, 8))).toEqual([255, 0, 0, 255]);
		expect(document.marquee()).toMatchObject({ x: 1, y: 0, width: 1, height: 1 });
		expect(events).toEqual(['snapshot', 'render', 'dirty']);
	});

	it('undo restores pixels and the Marquee together after a canvas flip', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(1 * 2 * 4);
		pixels.set([255, 0, 0, 255], 0);
		pixels.set([0, 255, 0, 255], 4);
		let current = singleLayerDocument(1, 2, pixels);
		current.set_marquee(marqueeRegionFromDrag(0, 0, 0, 0));
		const journal = createJournal(events, current, {
			getDocument: () => current,
			replaceDocument: (document) => {
				current = document;
			},
			createDocumentHistory
		});

		journal.commit({ kind: 'undoable-document', intent: { type: 'flip-canvas-vertical' } });
		expect(getPixelAt(current, 0, 1)).toEqual([255, 0, 0, 255]);
		expect(current.marquee()).toMatchObject({ x: 0, y: 1, width: 1, height: 1 });

		// One history entry: a single undo restores pixels and Marquee together.
		expect(journal.undo()).toEqual({ changed: true });
		expect(getPixelAt(current, 0, 0)).toEqual([255, 0, 0, 255]);
		expect(current.marquee()).toMatchObject({ x: 0, y: 0, width: 1, height: 1 });

		expect(journal.redo()).toEqual({ changed: true });
		expect(getPixelAt(current, 0, 1)).toEqual([255, 0, 0, 255]);
		expect(current.marquee()).toMatchObject({ x: 0, y: 1, width: 1, height: 1 });
	});

	it('rotates the marquee region clockwise as one undoable document change', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(3 * 3 * 4);
		pixels.set([255, 0, 0, 255], (1 * 3 + 0) * 4);
		pixels.set([0, 255, 0, 255], (1 * 3 + 1) * 4);
		pixels.set([0, 0, 255, 255], (1 * 3 + 2) * 4);
		const document = singleLayerDocument(3, 3, pixels);
		document.set_marquee(marqueeRegionFromDrag(0, 1, 2, 1));
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'rotate-marquee-cw' }
		});

		expect(result).toEqual({ changed: true });
		// The horizontal strip becomes a vertical column re-centered on (1, 1).
		expect(getPixelAt(document, 1, 0)).toEqual([255, 0, 0, 255]);
		expect(getPixelAt(document, 1, 1)).toEqual([0, 255, 0, 255]);
		expect(getPixelAt(document, 1, 2)).toEqual([0, 0, 255, 255]);
		expect(document.marquee()).toMatchObject({ x: 1, y: 0, width: 1, height: 3 });
		expect(events).toEqual(['snapshot', 'render', 'dirty']);
	});

	it('undo restores and redo re-applies a rotate, including the Marquee', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(3 * 3 * 4);
		pixels.set([255, 0, 0, 255], (1 * 3 + 0) * 4);
		pixels.set([0, 255, 0, 255], (1 * 3 + 1) * 4);
		pixels.set([0, 0, 255, 255], (1 * 3 + 2) * 4);
		let current = singleLayerDocument(3, 3, pixels);
		current.set_marquee(marqueeRegionFromDrag(0, 1, 2, 1));
		const journal = createJournal(events, current, {
			getDocument: () => current,
			replaceDocument: (document) => {
				current = document;
			},
			createDocumentHistory
		});

		journal.commit({ kind: 'undoable-document', intent: { type: 'rotate-marquee-cw' } });
		expect(getPixelAt(current, 1, 0)).toEqual([255, 0, 0, 255]);

		expect(journal.undo()).toEqual({ changed: true });
		expect(getPixelAt(current, 0, 1)).toEqual([255, 0, 0, 255]);
		expect(getPixelAt(current, 2, 1)).toEqual([0, 0, 255, 255]);
		expect(current.marquee()).toMatchObject({ x: 0, y: 1, width: 3, height: 1 });

		expect(journal.redo()).toEqual({ changed: true });
		expect(getPixelAt(current, 1, 0)).toEqual([255, 0, 0, 255]);
		expect(current.marquee()).toMatchObject({ x: 1, y: 0, width: 1, height: 3 });
	});

	it('skips a marquee rotate and captures no snapshot without a Marquee', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(2 * 1 * 4);
		pixels.set([255, 0, 0, 255], 0);
		const document = singleLayerDocument(2, 1, pixels);
		const journal = createJournal(events, document);

		expect(
			journal.commit({ kind: 'undoable-document', intent: { type: 'rotate-marquee-cw' } })
		).toEqual({ changed: false });
		expect(
			journal.commit({ kind: 'undoable-document', intent: { type: 'rotate-marquee-ccw' } })
		).toEqual({ changed: false });
		// The Document is untouched: no undo entry, no dirty mark, and the
		// dimensions never swap (whole-document turns are rotate-canvas-*).
		expect(events).toEqual([]);
		expect([document.width, document.height]).toEqual([2, 1]);
		expect(getPixelAt(document, 0, 0)).toEqual([255, 0, 0, 255]);
	});

	it('rotates the whole canvas clockwise as one undoable change even with a Marquee', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(2 * 1 * 4);
		pixels.set([255, 0, 0, 255], 0); // (0,0) red
		pixels.set([0, 255, 0, 255], 4); // (1,0) green
		const document = singleLayerDocument(2, 1, pixels);
		document.set_marquee(marqueeRegionFromDrag(1, 0, 1, 0));
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'rotate-canvas-cw' }
		});

		expect(result).toEqual({ changed: true });
		// A Marquee never diverts the canvas op into region mode: the whole
		// document turns 2×1 → 1×2 with red on top and green below.
		expect([document.width, document.height]).toEqual([1, 2]);
		expect(getPixelAt(document, 0, 0)).toEqual([255, 0, 0, 255]);
		expect(getPixelAt(document, 0, 1)).toEqual([0, 255, 0, 255]);
		// The Marquee is carried through the same quarter-turn, still on green.
		expect(document.marquee()).toMatchObject({ x: 0, y: 1, width: 1, height: 1 });
		// A canvas rotate always swaps dimensions — metrics and viewport
		// refresh like resize-document.
		expect(events).toEqual(['snapshot', 'sync', 'reclamp', 'render', 'dirty']);
	});

	it('undo restores dimensions, pixels, and the Marquee together after a canvas rotate', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(2 * 1 * 4);
		pixels.set([255, 0, 0, 255], 0);
		pixels.set([0, 255, 0, 255], 4);
		let current = singleLayerDocument(2, 1, pixels);
		current.set_marquee(marqueeRegionFromDrag(1, 0, 1, 0));
		const journal = createJournal(events, current, {
			getDocument: () => current,
			replaceDocument: (document) => {
				current = document;
			},
			createDocumentHistory
		});

		journal.commit({ kind: 'undoable-document', intent: { type: 'rotate-canvas-ccw' } });
		// Counter-clockwise: green (1, 0) → (0, 0), the Marquee following it.
		expect([current.width, current.height]).toEqual([1, 2]);
		expect(getPixelAt(current, 0, 0)).toEqual([0, 255, 0, 255]);
		expect(current.marquee()).toMatchObject({ x: 0, y: 0, width: 1, height: 1 });

		// One history entry: a single undo brings back pixels, dimensions, and
		// the Marquee together.
		expect(journal.undo()).toEqual({ changed: true });
		expect([current.width, current.height]).toEqual([2, 1]);
		expect(getPixelAt(current, 1, 0)).toEqual([0, 255, 0, 255]);
		expect(current.marquee()).toMatchObject({ x: 1, y: 0, width: 1, height: 1 });
	});

	it('skips a canvas rotate and captures no snapshot on a square Reference-only document', () => {
		const events: string[] = [];
		// The Reference Layer stays fixed under canvas transforms, so on a
		// Reference-only document a rotate only swaps the dimensions — and a
		// square canvas leaves even those unchanged. With no Marquee either,
		// nothing changes: it must not snapshot or dirty.
		const document = {
			width: 16,
			height: 16,
			active_layer_id: () => 'reference-1',
			layer_count: () => 1,
			marquee: () => undefined,
			layers_metadata: () => [
				{ id: 'reference-1', name: 'Reference', visible: true, opacity: 1, kind: 'reference' }
			]
		} as unknown as Document;
		const journal = createJournal(events, document);

		expect(
			journal.commit({ kind: 'undoable-document', intent: { type: 'rotate-canvas-cw' } })
		).toEqual({ changed: false });
		expect(
			journal.commit({ kind: 'undoable-document', intent: { type: 'rotate-canvas-ccw' } })
		).toEqual({ changed: false });
		expect(events).toEqual([]);
	});

	it('applies a canvas rotate on a non-square Reference-only document (the dimension swap is a real change)', () => {
		const events: string[] = [];
		const document = {
			width: 8,
			height: 16,
			active_layer_id: () => 'reference-1',
			layer_count: () => 1,
			marquee: () => undefined,
			layers_metadata: () => [
				{ id: 'reference-1', name: 'Reference', visible: true, opacity: 1, kind: 'reference' }
			],
			rotate_canvas_cw: () => events.push('rotate-canvas-cw')
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'rotate-canvas-cw' }
		});

		expect(result).toEqual({ changed: true });
		expect(events).toEqual(['snapshot', 'rotate-canvas-cw', 'sync', 'reclamp', 'render', 'dirty']);
	});

	it('skips a marquee rotate and captures no snapshot when the active layer is Reference', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			active_layer_id: () => 'reference-1',
			layer_count: () => 1,
			layers_metadata: () => [
				{ id: 'reference-1', name: 'Reference', visible: true, opacity: 1, kind: 'reference' }
			],
			marquee: () => ({ x: 0, y: 0, width: 4, height: 4 })
		} as unknown as Document;
		const journal = createJournal(events, document);

		expect(
			journal.commit({ kind: 'undoable-document', intent: { type: 'rotate-marquee-cw' } })
		).toEqual({ changed: false });
		expect(
			journal.commit({ kind: 'undoable-document', intent: { type: 'rotate-marquee-ccw' } })
		).toEqual({ changed: false });
		expect(events).toEqual([]);
	});

	it('commits a Floating Selection move as one undoable document change', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(4 * 4 * 4);
		pixels.set([255, 0, 0, 255], (0 * 4 + 0) * 4);
		pixels.set([0, 255, 0, 255], (0 * 4 + 1) * 4);
		pixels.set([0, 0, 255, 255], (2 * 4 + 2) * 4);
		let current = singleLayerDocument(4, 4, pixels);
		const sourceRegion = marqueeRegionFromDrag(0, 0, 1, 0);
		current.set_marquee(sourceRegion);
		const committedSourceRegion = current.marquee()!;
		const sourceLayerId = current.active_layer_id();
		const sourceLayerPixelsBeforeLift = current.layer_pixels_at(0)!.slice();
		const buffer = current.lift_marquee_pixels();
		const journal = createJournal(events, current, {
			getDocument: () => current,
			replaceDocument: (document) => {
				current = document;
				events.push(`replace:${document.width}x${document.height}`);
			},
			createDocumentHistory
		});

		const result = journal.commit({
			kind: 'undoable-document',
			intent: {
				type: 'commit-floating-selection',
				sourceLayerId,
				sourceRegion: committedSourceRegion,
				destOffset: { dx: 1, dy: 1 },
				buffer,
				sourceLayerPixelsBeforeLift
			}
		});

		expect(result).toEqual({ changed: true });
		expect(getPixelAt(current, 0, 0)).toEqual([0, 0, 0, 0]);
		expect(getPixelAt(current, 1, 0)).toEqual([0, 0, 0, 0]);
		expect(getPixelAt(current, 1, 1)).toEqual([255, 0, 0, 255]);
		expect(getPixelAt(current, 2, 1)).toEqual([0, 255, 0, 255]);
		expect(getPixelAt(current, 2, 2)).toEqual([0, 0, 255, 255]);
		expect(current.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });

		expect(journal.undo()).toEqual({ changed: true });
		expect(getPixelAt(current, 0, 0)).toEqual([255, 0, 0, 255]);
		expect(getPixelAt(current, 1, 0)).toEqual([0, 255, 0, 255]);
		expect(getPixelAt(current, 1, 1)).toEqual([0, 0, 0, 0]);
		expect(getPixelAt(current, 2, 1)).toEqual([0, 0, 0, 0]);
		expect(getPixelAt(current, 2, 2)).toEqual([0, 0, 255, 255]);
		expect(current.marquee()).toMatchObject({ x: 0, y: 0, width: 2, height: 1 });

		expect(journal.redo()).toEqual({ changed: true });
		expect(getPixelAt(current, 1, 1)).toEqual([255, 0, 0, 255]);
		expect(getPixelAt(current, 2, 1)).toEqual([0, 255, 0, 255]);
		expect(current.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
	});

	it('commits a Floating Selection to its source layer after the active layer changes', () => {
		const events: string[] = [];
		const sourceId = crypto.randomUUID();
		const topId = crypto.randomUUID();
		const sourcePixels = new Uint8Array(4 * 4 * 4);
		sourcePixels.set([255, 0, 0, 255], (0 * 4 + 0) * 4);
		sourcePixels.set([0, 255, 0, 255], (0 * 4 + 1) * 4);
		const topPixels = new Uint8Array(4 * 4 * 4);
		topPixels.set([0, 0, 255, 255], (1 * 4 + 1) * 4);
		let current = documentFromLayerSource({
			width: 4,
			height: 4,
			layers: [
				{
					kind: 'pixel',
					id: sourceId,
					name: 'Source',
					pixels: sourcePixels,
					visible: true,
					opacity: 1
				},
				{
					kind: 'pixel',
					id: topId,
					name: 'Top',
					pixels: topPixels,
					visible: true,
					opacity: 1
				}
			],
			activeLayerId: sourceId,
			nextLayerNumber: 3,
			timelinePanelCollapsed: false
		});
		const sourceRegion = marqueeRegionFromDrag(0, 0, 1, 0);
		current.set_marquee(sourceRegion);
		const committedSourceRegion = current.marquee()!;
		const sourceLayerPixelsBeforeLift = current.layer_pixels_at(0)!.slice();
		const buffer = current.lift_marquee_pixels();
		current.clear_marquee_pixels();
		current.set_active_layer(topId);
		const journal = createJournal(events, current, {
			getDocument: () => current,
			replaceDocument: (document) => {
				current = document;
				events.push(`replace:${document.width}x${document.height}`);
			},
			createDocumentHistory
		});

		const result = journal.commit({
			kind: 'undoable-document',
			intent: {
				type: 'commit-floating-selection',
				sourceLayerId: sourceId,
				sourceRegion: committedSourceRegion,
				destOffset: { dx: 1, dy: 1 },
				buffer,
				sourceLayerPixelsBeforeLift
			}
		});

		expect(result).toEqual({ changed: true });
		expect(current.active_layer_id()).toBe(topId);
		expect(getLayerPixelAt(current, 0, 0, 0)).toEqual([0, 0, 0, 0]);
		expect(getLayerPixelAt(current, 0, 1, 0)).toEqual([0, 0, 0, 0]);
		expect(getLayerPixelAt(current, 0, 1, 1)).toEqual([255, 0, 0, 255]);
		expect(getLayerPixelAt(current, 0, 2, 1)).toEqual([0, 255, 0, 255]);
		expect(getLayerPixelAt(current, 1, 1, 1)).toEqual([0, 0, 255, 255]);
		expect(current.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });

		expect(journal.undo()).toEqual({ changed: true });
		expect(current.active_layer_id()).toBe(topId);
		expect(getLayerPixelAt(current, 0, 0, 0)).toEqual([255, 0, 0, 255]);
		expect(getLayerPixelAt(current, 0, 1, 0)).toEqual([0, 255, 0, 255]);
		expect(getLayerPixelAt(current, 1, 1, 1)).toEqual([0, 0, 255, 255]);
	});

	it('clips a Floating Selection commit when the destination leaves the canvas', () => {
		const events: string[] = [];
		const pixels = new Uint8Array(3 * 3 * 4);
		pixels.set([255, 0, 0, 255], (1 * 3 + 1) * 4);
		pixels.set([0, 255, 0, 255], (1 * 3 + 2) * 4);
		const document = singleLayerDocument(3, 3, pixels);
		const sourceRegion = marqueeRegionFromDrag(1, 1, 2, 1);
		document.set_marquee(sourceRegion);
		const committedSourceRegion = document.marquee()!;
		const sourceLayerId = document.active_layer_id();
		const sourceLayerPixelsBeforeLift = document.layer_pixels_at(0)!.slice();
		const buffer = document.lift_marquee_pixels();
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: {
				type: 'commit-floating-selection',
				sourceLayerId,
				sourceRegion: committedSourceRegion,
				destOffset: { dx: -2, dy: 0 },
				buffer,
				sourceLayerPixelsBeforeLift
			}
		});

		expect(result).toEqual({ changed: true });
		expect(getPixelAt(document, 0, 1)).toEqual([0, 255, 0, 255]);
		expect(getPixelAt(document, 1, 1)).toEqual([0, 0, 0, 0]);
		expect(getPixelAt(document, 2, 1)).toEqual([0, 0, 0, 0]);
		expect(document.marquee()).toMatchObject({ x: -1, y: 1, width: 2, height: 1 });
	});

	it('skips active-layer clear when the active layer is Reference', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			active_layer_id: () => 'reference-1',
			layer_count: () => 1,
			layers_metadata: () => [
				{ id: 'reference-1', name: 'Reference', visible: true, opacity: 1, kind: 'reference' }
			]
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'clear-active-layer' }
		});

		expect(result).toEqual({ changed: false });
		expect(events).toEqual([]);
	});

	it('skips Marquee pixel clear on a Reference-active document without invalidating render', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			active_layer_id: () => 'reference-1',
			marquee: () => ({ x: 1, y: 1, width: 2, height: 2 }),
			layer_count: () => 1,
			layers_metadata: () => [
				{ id: 'reference-1', name: 'Reference', visible: true, opacity: 1, kind: 'reference' }
			]
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'clear-marquee-pixels' }
		});

		expect(result).toEqual({ changed: false });
		expect(events).toEqual([]);
	});

	it('applies reorder changes without reclamping unchanged navigation bounds', () => {
		const events: string[] = [];
		const ids = ['layer-1', 'layer-2'];
		const document = {
			width: 16,
			height: 16,
			layer_count: () => ids.length,
			layers_metadata: () =>
				ids.map((id) => ({ id, name: id, visible: true, opacity: 1, kind: 'pixel' })),
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

	it('applies an undoable add-frame change: snapshot, mints a frame id, render + dirty (no reclamp)', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			add_frame: (id: string) => events.push(`add-frame:${id}`)
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'add-frame' }
		});

		expect(result).toEqual({ changed: true, frameId: 'frame-2' });
		// No 'reclamp': frame ops leave the canvas size and active layer untouched.
		expect(events).toEqual(['snapshot', 'add-frame:frame-2', 'render', 'dirty']);
	});

	it('applies an undoable duplicate-frame change: snapshot, mints a frame id, render + dirty', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			duplicate_frame: (id: string) => events.push(`duplicate-frame:${id}`)
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'duplicate-frame' }
		});

		expect(result).toEqual({ changed: true, frameId: 'frame-2' });
		expect(events).toEqual(['snapshot', 'duplicate-frame:frame-2', 'render', 'dirty']);
	});

	it('applies an undoable remove-frame change when more than one frame remains', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			frame_count: () => 2,
			remove_frame: (id: string) => events.push(`remove-frame:${id}`)
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'remove-frame', id: 'frame-9' }
		});

		expect(result).toEqual({ changed: true });
		expect(events).toEqual(['snapshot', 'remove-frame:frame-9', 'render', 'dirty']);
	});

	it('skips remove-frame entirely when only one frame remains (no snapshot, no apply)', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			frame_count: () => 1
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'remove-frame', id: 'only-frame' }
		});

		expect(result).toEqual({ changed: false });
		expect(events).toEqual([]);
	});

	it('applies an undoable reorder-frame change to a new axis position', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			frames_metadata: () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
			reorder_frame: (id: string, index: number) => events.push(`reorder-frame:${id}:${index}`)
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'reorder-frame', id: 'c', newIndex: 0 }
		});

		expect(result).toEqual({ changed: true });
		expect(events).toEqual(['snapshot', 'reorder-frame:c:0', 'render', 'dirty']);
	});

	it('skips reorder-frame when the frame is already at the target index', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			frames_metadata: () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'reorder-frame', id: 'b', newIndex: 1 }
		});

		expect(result).toEqual({ changed: false });
		expect(events).toEqual([]);
	});

	it('applies an undoable set-frame-duration change: snapshot, render + dirty (no reclamp)', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			frames_metadata: () => [{ id: 'frame-1', duration_ms: 100 }],
			set_frame_duration: (id: string, durationMs: number) =>
				events.push(`set-frame-duration:${id}:${durationMs}`)
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'set-frame-duration', id: 'frame-1', durationMs: 250 }
		});

		expect(result).toEqual({ changed: true });
		// No 'reclamp': retiming a frame changes neither dimensions nor the active layer.
		expect(events).toEqual(['snapshot', 'set-frame-duration:frame-1:250', 'render', 'dirty']);
	});

	it('skips set-frame-duration when the frame already has the requested duration', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			frames_metadata: () => [{ id: 'frame-1', duration_ms: 250 }]
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'undoable-document',
			intent: { type: 'set-frame-duration', id: 'frame-1', durationMs: 250 }
		});

		expect(result).toEqual({ changed: false });
		expect(events).toEqual([]);
	});

	it('throws set-frame-duration for a frame id that is not on the axis', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			frames_metadata: () => [{ id: 'frame-1', duration_ms: 100 }]
		} as unknown as Document;
		const journal = createJournal(events, document);

		expect(() =>
			journal.commit({
				kind: 'undoable-document',
				intent: { type: 'set-frame-duration', id: 'absent', durationMs: 250 }
			})
		).toThrow('Frame with id absent not found');
		expect(events).toEqual([]);
	});

	it('applies set-active-frame without an undo snapshot (persisted, not undoable, no reclamp)', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			active_frame_id: () => 'frame-1',
			set_active_frame: (id: string) => events.push(`set-active-frame:${id}`)
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'persisted-document-ui',
			intent: { type: 'set-active-frame', id: 'frame-2' }
		});

		expect(result).toEqual({ changed: true });
		// No 'snapshot' (not undoable) and no 'reclamp' (active layer unchanged),
		// unlike set-active-layer.
		expect(events).toEqual(['set-active-frame:frame-2', 'render', 'dirty']);
	});

	it('skips set-active-frame when the frame is already active', () => {
		const events: string[] = [];
		const document = {
			width: 16,
			height: 16,
			active_frame_id: () => 'frame-1'
		} as unknown as Document;
		const journal = createJournal(events, document);

		const result = journal.commit({
			kind: 'persisted-document-ui',
			intent: { type: 'set-active-frame', id: 'frame-1' }
		});

		expect(result).toEqual({ changed: false });
		expect(events).toEqual([]);
	});
});
