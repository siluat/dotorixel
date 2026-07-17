import type { Document, MarqueeRegion, ReferencePlacement, ResizeAnchor } from '../canvas-model';
import type { DocumentHistory } from '../adapter-types';
import type { DocumentLayerKind, DocumentLayerProjectionRead } from '../document-layer-projection';

export interface ReferenceLayerSource {
	readonly name: string;
	readonly sourceBlob: Blob;
	readonly sourceRgba: Uint8Array | Uint8ClampedArray;
	readonly naturalWidth: number;
	readonly naturalHeight: number;
}

export type UndoableDocumentIntent =
	| { readonly type: 'add-pixel-layer'; readonly name: string }
	| { readonly type: 'set-reference-layer'; readonly source: ReferenceLayerSource }
	| { readonly type: 'remove-layer'; readonly id: string }
	| { readonly type: 'reorder-layer'; readonly id: string; readonly newVisualIndex: number }
	| { readonly type: 'set-layer-visibility'; readonly id: string; readonly visible: boolean }
	| {
			readonly type: 'set-reference-placement';
			readonly id: string;
			readonly placement: ReferencePlacement;
	  }
	| {
			readonly type: 'resize-document';
			readonly width: number;
			readonly height: number;
			readonly anchor: ResizeAnchor;
	  }
	| { readonly type: 'clear-active-layer' }
	| { readonly type: 'clear-marquee-pixels' }
	| { readonly type: 'flip-marquee-horizontal' }
	| { readonly type: 'flip-marquee-vertical' }
	| { readonly type: 'flip-canvas-horizontal' }
	| { readonly type: 'flip-canvas-vertical' }
	| { readonly type: 'rotate-marquee-cw' }
	| { readonly type: 'rotate-marquee-ccw' }
	| { readonly type: 'rotate-canvas-cw' }
	| { readonly type: 'rotate-canvas-ccw' }
	| {
			readonly type: 'commit-floating-selection';
			readonly sourceLayerId: string;
			readonly sourceRegion: MarqueeRegion;
			readonly destOffset: { readonly dx: number; readonly dy: number };
			readonly buffer: Uint8Array;
			readonly clearSourceRegion?: boolean;
			readonly snapshotMarquee?: MarqueeRegion | null;
			readonly sourceLayerPixelsBeforeLift?: Uint8Array;
	  }
	| { readonly type: 'set-marquee'; readonly region: MarqueeRegion | null }
	| { readonly type: 'add-frame' }
	| { readonly type: 'duplicate-frame' }
	| { readonly type: 'remove-frame'; readonly id: string }
	| { readonly type: 'reorder-frame'; readonly id: string; readonly newIndex: number }
	| { readonly type: 'set-frame-duration'; readonly id: string; readonly durationMs: number };

export type PersistedDocumentUiIntent =
	| { readonly type: 'set-active-layer'; readonly id: string }
	| { readonly type: 'set-active-frame'; readonly id: string }
	| { readonly type: 'set-timeline-panel-collapsed'; readonly collapsed: boolean };

export type DocumentChange =
	| { readonly kind: 'undoable-document'; readonly intent: UndoableDocumentIntent }
	| { readonly kind: 'persisted-document-ui'; readonly intent: PersistedDocumentUiIntent };

export type DocumentChangeResult =
	| { readonly changed: false }
	| { readonly changed: true; readonly layerId?: string; readonly frameId?: string };

export interface DocumentChangeJournalDeps {
	readonly getDocument: () => Document;
	readonly getLayerProjection: () => DocumentLayerProjectionRead;
	readonly replaceDocument: (document: Document) => void;
	readonly createDocumentHistory: () => DocumentHistory;
	readonly createLayerId?: () => string;
	readonly createFrameId?: () => string;
	readonly rememberReferenceLayerBlob: (layerId: string, sourceBlob: Blob) => void;
	readonly clearActiveLayerPixels: (document: Document) => void;
	readonly resizeDocument: (
		document: Document,
		width: number,
		height: number,
		anchor: ResizeAnchor
	) => void;
	readonly syncDocumentMetrics: () => void;
	readonly reclampViewport: () => void;
	readonly invalidateRender: () => void;
	readonly markDirty: () => void;
}

function sameMarqueeRegion(
	a: MarqueeRegion | null | undefined,
	b: MarqueeRegion | null | undefined
): boolean {
	if (!a || !b) return !a && !b;
	return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function translateMarqueeRegion(
	region: MarqueeRegion,
	offset: { readonly dx: number; readonly dy: number }
): MarqueeRegion {
	return region.translate(offset.dx, offset.dy);
}

/**
 * Applies classified web-shell changes to a tab's active Document and owns the
 * shell-side follow-up sequence around the Rust core Document.
 */
export class DocumentChangeJournal {
	#deps: DocumentChangeJournalDeps;
	#history: DocumentHistory;
	#historyVersion = $state(0);

	constructor(deps: DocumentChangeJournalDeps) {
		this.#deps = deps;
		this.#history = deps.createDocumentHistory();
	}

	get canUndo(): boolean {
		void this.#historyVersion;
		return this.#history.can_undo();
	}

	get canRedo(): boolean {
		void this.#historyVersion;
		return this.#history.can_redo();
	}

	commit(change: DocumentChange): DocumentChangeResult {
		switch (change.kind) {
			case 'undoable-document':
				return this.#commitUndoableDocument(change.intent);
			case 'persisted-document-ui':
				return this.#commitPersistedDocumentUi(change.intent);
		}
	}

	captureUndoSnapshot(): void {
		this.#history.push_document(this.#deps.getDocument());
		this.#historyVersion++;
	}

	/**
	 * Holds the current document as the pending Edit Baseline. Nothing is
	 * pushed and the redo future stays untouched until `endEdit` resolves it.
	 */
	beginEdit(): void {
		this.#history.begin_edit(this.#deps.getDocument());
	}

	/**
	 * Resolves the pending Edit Baseline against the current document — the
	 * undo entry commits (clearing the redo future) only when the edit
	 * actually changed the document; a no-op edit leaves History untouched.
	 * No-op when no baseline is pending (e.g. an eyedropper stroke).
	 */
	endEdit(): void {
		this.#history.end_edit(this.#deps.getDocument());
		this.#historyVersion++;
	}

	recordCanvasChanged(): void {
		this.#invalidateRenderAndMarkDirty();
	}

	recordPreviewChanged(): void {
		this.#deps.invalidateRender();
	}

	undo(): DocumentChangeResult {
		const restored = this.#history.undo_document(this.#deps.getDocument());
		if (!restored) return { changed: false };
		this.#historyVersion++;
		this.#replaceDocument(restored);
		return { changed: true };
	}

	redo(): DocumentChangeResult {
		const restored = this.#history.redo_document(this.#deps.getDocument());
		if (!restored) return { changed: false };
		this.#historyVersion++;
		this.#replaceDocument(restored);
		return { changed: true };
	}

	#commitUndoableDocument(intent: UndoableDocumentIntent): DocumentChangeResult {
		if (!this.#willChangeUndoableDocument(intent)) return { changed: false };
		this.#restoreFloatingSelectionBaselineForSnapshot(intent);
		this.captureUndoSnapshot();
		const result = this.#applyUndoableDocumentIntent(intent);
		this.#afterUndoableDocumentChanged(intent);
		return result;
	}

	#restoreFloatingSelectionBaselineForSnapshot(intent: UndoableDocumentIntent): void {
		if (intent.type !== 'commit-floating-selection') return;
		const baseline = intent.sourceLayerPixelsBeforeLift;
		if (!baseline) return;
		const snapshotMarquee =
			intent.snapshotMarquee === undefined ? intent.sourceRegion : intent.snapshotMarquee;

		this.#withActiveLayer(intent.sourceLayerId, (document) => {
			document.restore_active_layer_pixels(baseline);
			document.set_marquee(snapshotMarquee ? snapshotMarquee.translate(0, 0) : null);
		});
	}

	#applyUndoableDocumentIntent(intent: UndoableDocumentIntent): DocumentChangeResult {
		const document = this.#deps.getDocument();
		switch (intent.type) {
			case 'add-pixel-layer': {
				const layerId = this.#deps.createLayerId?.() ?? crypto.randomUUID();
				document.add_layer(layerId, intent.name);
				return { changed: true, layerId };
			}
			case 'set-reference-layer': {
				const layerId = this.#deps.createLayerId?.() ?? crypto.randomUUID();
				document.add_reference_layer(
					layerId,
					intent.source.name,
					new Uint8Array(intent.source.sourceRgba),
					intent.source.naturalWidth,
					intent.source.naturalHeight
				);
				this.#deps.rememberReferenceLayerBlob(layerId, intent.source.sourceBlob);
				return { changed: true, layerId };
			}
			case 'remove-layer':
				document.remove_layer(intent.id);
				return { changed: true };
			case 'reorder-layer':
				document.reorder_layer(intent.id, this.#effectiveReorderStackIndex(intent));
				return { changed: true };
			case 'set-layer-visibility':
				document.set_layer_visibility(intent.id, intent.visible);
				return { changed: true };
			case 'set-reference-placement':
				document.set_reference_placement(
					intent.id,
					intent.placement.x,
					intent.placement.y,
					intent.placement.scale
				);
				return { changed: true };
			case 'resize-document':
				this.#deps.resizeDocument(document, intent.width, intent.height, intent.anchor);
				return { changed: true };
			case 'clear-active-layer':
				this.#deps.clearActiveLayerPixels(document);
				return { changed: true };
			case 'clear-marquee-pixels':
				document.clear_marquee_pixels();
				return { changed: true };
			case 'flip-marquee-horizontal':
				document.flip_marquee_horizontal();
				return { changed: true };
			case 'flip-marquee-vertical':
				document.flip_marquee_vertical();
				return { changed: true };
			case 'flip-canvas-horizontal':
				document.flip_canvas_horizontal();
				return { changed: true };
			case 'flip-canvas-vertical':
				document.flip_canvas_vertical();
				return { changed: true };
			case 'rotate-marquee-cw':
				document.rotate_marquee_cw();
				return { changed: true };
			case 'rotate-marquee-ccw':
				document.rotate_marquee_ccw();
				return { changed: true };
			case 'rotate-canvas-cw':
				document.rotate_canvas_cw();
				return { changed: true };
			case 'rotate-canvas-ccw':
				document.rotate_canvas_ccw();
				return { changed: true };
			case 'commit-floating-selection': {
				const destRegion = translateMarqueeRegion(intent.sourceRegion, intent.destOffset);
				this.#withActiveLayer(intent.sourceLayerId, (document) => {
					if (intent.clearSourceRegion ?? true) {
						document.set_marquee(intent.sourceRegion.translate(0, 0));
						document.clear_marquee_pixels();
					}
					document.composite_buffer_at(intent.buffer, destRegion);
					document.set_marquee(destRegion);
				});
				return { changed: true };
			}
			case 'set-marquee':
				document.set_marquee(intent.region);
				return { changed: true };
			case 'add-frame': {
				const frameId = this.#deps.createFrameId?.() ?? crypto.randomUUID();
				document.add_frame(frameId);
				return { changed: true, frameId };
			}
			case 'duplicate-frame': {
				const frameId = this.#deps.createFrameId?.() ?? crypto.randomUUID();
				document.duplicate_frame(frameId);
				return { changed: true, frameId };
			}
			case 'remove-frame':
				document.remove_frame(intent.id);
				return { changed: true };
			case 'reorder-frame':
				document.reorder_frame(intent.id, intent.newIndex);
				return { changed: true };
			case 'set-frame-duration':
				document.set_frame_duration(intent.id, intent.durationMs);
				return { changed: true };
		}
	}

	#commitPersistedDocumentUi(intent: PersistedDocumentUiIntent): DocumentChangeResult {
		if (!this.#willChangePersistedDocumentUi(intent)) return { changed: false };
		const document = this.#deps.getDocument();
		switch (intent.type) {
			case 'set-active-layer':
				document.set_active_layer(intent.id);
				break;
			case 'set-active-frame':
				document.set_active_frame(intent.id);
				break;
			case 'set-timeline-panel-collapsed':
				document.set_timeline_panel_collapsed(intent.collapsed);
				break;
		}
		this.#afterPersistedDocumentUiChanged(intent);
		return { changed: true };
	}

	#willChangeUndoableDocument(intent: UndoableDocumentIntent): boolean {
		const document = this.#deps.getDocument();
		switch (intent.type) {
			case 'add-pixel-layer':
				return true;
			case 'set-reference-layer':
				this.#assertValidReferenceLayerSource(intent.source);
				return true;
			case 'remove-layer':
				return document.layer_count() > 1;
			case 'reorder-layer': {
				const layer = this.#layerOf(intent.id);
				if (layer.kind === 'reference') return false;
				return layer.stackIndex !== this.#effectiveReorderStackIndex(intent);
			}
			case 'set-layer-visibility': {
				return this.#layerOf(intent.id).visible !== intent.visible;
			}
			case 'set-reference-placement': {
				const layer = this.#layerOf(intent.id);
				const current = document.layers_metadata()[layer.stackIndex]?.placement;
				if (!current) {
					throw new Error(`Layer with id ${intent.id} is not a Reference Layer`);
				}
				return (
					current.x !== intent.placement.x ||
					current.y !== intent.placement.y ||
					current.scale !== intent.placement.scale
				);
			}
			case 'resize-document':
				return intent.width !== document.width || intent.height !== document.height;
			case 'clear-active-layer':
				return this.#activeLayerKind() === 'pixel';
			case 'flip-canvas-horizontal':
			case 'flip-canvas-vertical':
				// A Canvas Transform mirrors every Pixel Layer's every cel and an
				// active Marquee, independent of the active layer kind — but a
				// Reference-only document with no Marquee gives it nothing to
				// mirror, so skip the snapshot for that no-op.
				return (
					this.#deps
						.getLayerProjection()
						.layersInStackOrder.some((layer) => layer.kind === 'pixel') ||
					Boolean(document.marquee())
				);
			case 'clear-marquee-pixels':
			// A Marquee Transform mirrors or turns only the Marquee region of
			// the active Pixel Layer's active-frame cel — without a Marquee or
			// while a Reference Layer is active it has nothing to transform,
			// so skip the snapshot for that no-op.
			case 'flip-marquee-horizontal':
			case 'flip-marquee-vertical':
			case 'rotate-marquee-cw':
			case 'rotate-marquee-ccw':
				return Boolean(document.marquee()) && this.#activeLayerKind() === 'pixel';
			case 'rotate-canvas-cw':
			case 'rotate-canvas-ccw':
				// A Canvas Transform turns every Pixel Layer's every cel, swaps the
				// dimensions, and carries an active Marquee — the Reference Layer
				// stays fixed. Only a square Reference-only document with no
				// Marquee gives it nothing to change, so skip that no-op.
				return (
					this.#deps
						.getLayerProjection()
						.layersInStackOrder.some((layer) => layer.kind === 'pixel') ||
					Boolean(document.marquee()) ||
					document.width !== document.height
				);
			case 'commit-floating-selection':
				return this.#layerKindOf(intent.sourceLayerId) === 'pixel' && intent.buffer.length > 0;
			case 'set-marquee':
				return (
					this.#activeLayerKind() === 'pixel' &&
					!sameMarqueeRegion(document.marquee(), intent.region)
				);
			case 'add-frame':
			case 'duplicate-frame':
				return true;
			case 'remove-frame':
				return document.frame_count() > 1;
			case 'reorder-frame': {
				const frames = document.frames_metadata();
				const from = frames.findIndex((frame) => frame.id === intent.id);
				if (from === -1) {
					throw new Error(`Frame with id ${intent.id} not found`);
				}
				const to = Math.min(Math.max(intent.newIndex, 0), frames.length - 1);
				return from !== to;
			}
			case 'set-frame-duration': {
				const frame = document.frames_metadata().find((f) => f.id === intent.id);
				if (!frame) {
					throw new Error(`Frame with id ${intent.id} not found`);
				}
				// Mirror set-layer-visibility: a duration that already matches is a
				// no-op. The compare is against the requested value as-is — the
				// [1, 60_000] clamp lives at the WASM boundary, its single source.
				return frame.duration_ms !== intent.durationMs;
			}
		}
	}

	#willChangePersistedDocumentUi(intent: PersistedDocumentUiIntent): boolean {
		const document = this.#deps.getDocument();
		switch (intent.type) {
			case 'set-active-layer':
				return document.active_layer_id() !== intent.id;
			case 'set-active-frame':
				return document.active_frame_id() !== intent.id;
			case 'set-timeline-panel-collapsed':
				return document.is_timeline_panel_collapsed() !== intent.collapsed;
		}
	}

	#effectiveReorderStackIndex(
		intent: Extract<UndoableDocumentIntent, { type: 'reorder-layer' }>
	): number {
		const projection = this.#deps.getLayerProjection();
		const targetStackIdx = projection.layersInStackOrder.length - 1 - intent.newVisualIndex;
		return projection.layersInStackOrder[0]?.kind === 'reference'
			? Math.max(1, targetStackIdx)
			: targetStackIdx;
	}

	#layerOf(id: string) {
		const layer = this.#deps.getLayerProjection().layerById.get(id);
		if (layer) return layer;
		throw new Error(`Layer with id ${id} not found`);
	}

	#activeLayerKind(): DocumentLayerKind | undefined {
		return this.#deps.getLayerProjection().activeLayerKind;
	}

	#layerKindOf(id: string): DocumentLayerKind | undefined {
		return this.#layerOf(id).kind;
	}

	#withActiveLayer<T>(layerId: string, callback: (document: Document) => T): T {
		const document = this.#deps.getDocument();
		const previousLayerId = document.active_layer_id();
		if (previousLayerId !== layerId) {
			document.set_active_layer(layerId);
		}
		try {
			return callback(document);
		} finally {
			if (document.active_layer_id() !== previousLayerId) {
				document.set_active_layer(previousLayerId);
			}
		}
	}

	#assertValidReferenceLayerSource(source: ReferenceLayerSource): void {
		if (source.naturalWidth <= 0 || source.naturalHeight <= 0) {
			throw new Error('Reference Layer source dimensions must be positive');
		}
		if (source.sourceRgba.length !== source.naturalWidth * source.naturalHeight * 4) {
			throw new Error('Reference Layer source RGBA length must match dimensions');
		}
	}

	#afterUndoableDocumentChanged(intent: UndoableDocumentIntent): void {
		switch (intent.type) {
			case 'reorder-layer':
			case 'set-marquee':
			// Frame ops change which cel composites and the frame axis the panel
			// renders, but never the canvas dimensions or the active layer — so
			// Navigation Bounds are unaffected and no viewport reclamp is needed.
			// Retiming (set-frame-duration) likewise touches neither.
			case 'add-frame':
			case 'duplicate-frame':
			case 'remove-frame':
			case 'reorder-frame':
			case 'set-frame-duration':
				this.#invalidateRenderAndMarkDirty();
				break;
			case 'resize-document':
			// A canvas rotate always swaps the Document dimensions, so it must
			// refresh metrics and the viewport like resize-document.
			case 'rotate-canvas-cw':
			case 'rotate-canvas-ccw':
				this.#deps.syncDocumentMetrics();
				this.#reclampViewportInvalidateRenderAndMarkDirty();
				break;
			case 'clear-active-layer':
			case 'clear-marquee-pixels':
			// A Marquee Transform touches only the Marquee region of one cel —
			// the dimensions never change, so no metrics sync or viewport
			// reclamp is needed.
			case 'flip-marquee-horizontal':
			case 'flip-marquee-vertical':
			case 'rotate-marquee-cw':
			case 'rotate-marquee-ccw':
			// A canvas flip transforms the whole document but keeps its
			// dimensions, so no metrics sync or viewport reclamp is needed.
			case 'flip-canvas-horizontal':
			case 'flip-canvas-vertical':
			case 'commit-floating-selection':
				this.#invalidateRenderAndMarkDirty();
				break;
			case 'add-pixel-layer':
			case 'set-reference-layer':
			case 'remove-layer':
			case 'set-layer-visibility':
			case 'set-reference-placement':
				this.#reclampViewportInvalidateRenderAndMarkDirty();
				break;
		}
	}

	#afterPersistedDocumentUiChanged(intent: PersistedDocumentUiIntent): void {
		switch (intent.type) {
			case 'set-active-layer':
				this.#reclampViewportInvalidateRenderAndMarkDirty();
				break;
			case 'set-active-frame':
				// Unlike set-active-layer, switching frames keeps the active layer
				// fixed, so Navigation Bounds don't change — no reclamp.
				this.#invalidateRenderAndMarkDirty();
				break;
			case 'set-timeline-panel-collapsed':
				this.#invalidateRenderAndMarkDirty();
				break;
		}
	}

	#replaceDocument(document: Document): void {
		this.#deps.replaceDocument(document);
		this.#deps.syncDocumentMetrics();
		this.#reclampViewportInvalidateRenderAndMarkDirty();
	}

	#reclampViewportInvalidateRenderAndMarkDirty(): void {
		this.#deps.reclampViewport();
		this.#invalidateRenderAndMarkDirty();
	}

	#invalidateRenderAndMarkDirty(): void {
		this.#deps.invalidateRender();
		this.#deps.markDirty();
	}
}
