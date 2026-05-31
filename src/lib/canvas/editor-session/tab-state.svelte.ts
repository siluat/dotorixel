import type {
	Document,
	PixelCanvas,
	CanvasCoords,
	CanvasPoint,
	MarqueeRegion,
	ResizeAnchor,
	ReferencePlacement
} from '../canvas-model';
import {
	clearActiveLayerPixels,
	createHistoryManager,
	fitReferencePlacementToCanvas,
	resizeDocumentWithAnchor,
	singleLayerDocument
} from '../wasm-backend';
import { isBlankCanvas } from '../blank-detection';
import type { ViewportData, ViewportSize } from '../viewport';
import { addRecentColor } from '../color';
import type { SharedState } from '../shared-state.svelte';
import { decodeReferenceBlob } from '../../reference-images/decode-reference-blob';
import {
	createReferenceSamplingSession,
	type ReferenceSamplingSession
} from '../../reference-images/reference-sampling-session.svelte';
import { createDocumentSamplingPort } from '../sampling/adapters/document';
import {
	createNoReadableSamplingPort,
	createReferenceLayerUnderlaySamplingPort
} from '../sampling/adapters/reference-layer-underlay';
import { createSamplingSession, type SamplingSession } from '../sampling/session.svelte';
import type { LoupeInputSource } from '../sampling/types';
import { createToolRunner, type ToolRunner, type EditorEffects } from '../tool-runner.svelte';
import { exportAsPng } from '../export';
import type { PointerType } from '../canvas-interaction.svelte';
import type { ReferenceLayerSnapshot, TabSnapshot } from '../workspace-snapshot';
import {
	ReferenceLayerUnderlayProjector,
	referenceLayerUnderlayBounds,
	referenceLayerUnderlaySourceCoords,
	type ReferenceLayerUnderlay
} from '../reference-layer-underlay';
import type { CanvasBackend } from './canvas-backend';
import type { DirtyNotifier } from './dirty-notifier';
import {
	DocumentChangeJournal,
	type ReferenceLayerSource
} from './document-change-journal.svelte';
import { TabViewport } from './tab-viewport.svelte';

export type { ReferenceLayerSource } from './document-change-journal.svelte';

function assertNever(x: never): never {
	throw new Error(`Unhandled effect type: ${(x as { type: string }).type}`);
}

function isActiveLayerReference(document: Document): boolean {
	const activeId = document.active_layer_id();
	for (let i = 0; i < document.layer_count(); i++) {
		if (document.layer_id_at(i) !== activeId) continue;
		return document.layer_kind_at(i) === 'reference';
	}
	return false;
}

function serializeMarquee(region: MarqueeRegion | undefined): TabSnapshot['marquee'] {
	return region
		? {
				x: region.x,
				y: region.y,
				width: region.width,
				height: region.height
			}
		: null;
}

interface DocumentNavigationBounds {
	readonly minX: number;
	readonly minY: number;
	readonly maxX: number;
	readonly maxY: number;
}

export interface TabStateDeps {
	readonly backend: CanvasBackend;
	readonly shared: SharedState;
	readonly keyboard: { readonly getShiftHeld: () => boolean };
	readonly notifier: DirtyNotifier;
	readonly documentId: string;
	readonly name: string;
	/** When provided, the tab adopts this document; otherwise a fresh empty document is created from `canvasWidth`/`canvasHeight`. The Document is the single source of truth for pixel data. */
	readonly document?: Document;
	readonly referenceLayerBlobs?: ReadonlyMap<string, Blob>;
	/** When provided, the tab adopts this viewport; otherwise a fitted viewport is computed from the canvas dimensions. */
	readonly viewport?: ViewportData;
	readonly canvasWidth?: number;
	readonly canvasHeight?: number;
	readonly gridColor?: string;
}

const DEFAULT_CANVAS_DIMENSION = 16;
const DEFAULT_VIEWPORT_SIZE: ViewportSize = { width: 512, height: 512 };

/**
 * Per-tab editor state. Owns canvas, viewport, document change journal,
 * sampling session, and a tab-scoped tool runner. References (does not own)
 * the workspace's `SharedState` so changes to active tool / colors propagate
 * across tabs.
 *
 * Auto-emits `notifier.markDirty(documentId)` on every persistable mutation —
 * pixel changes, viewport changes, resizes, grid toggle, and shared-state
 * updates that originate from this tab's draw / sampling flow. Transient UI
 * state (`isExportUIOpen`, `resizeAnchor`) does not trigger notifications.
 */
export class TabState {
	readonly documentId: string;
	readonly name: string;
	readonly shared: SharedState;
	readonly samplingSession: SamplingSession;
	readonly referenceSamplingSession: ReferenceSamplingSession;

	document = $state<Document>(null!);
	renderVersion = $state(0);
	resizeAnchor = $state<ResizeAnchor>('top-left');
	isExportUIOpen = $state(false);

	// WASM Document is external — Svelte can't track its internal mutations,
	// so width/height are mirrored here and updated explicitly on resize().
	canvasWidth = $state(0);
	canvasHeight = $state(0);

	/**
	 * Renderer-facing view of the document. `pixels()` returns the full
	 * source-over composite of every visible Pixel Layer. Reference Layers are
	 * exposed separately through `referenceLayerUnderlay` so the renderer can draw
	 * the original image before the Pixel composite.
	 */
	get compositeBuffer(): { readonly width: number; readonly height: number; pixels(): Uint8Array } {
		const self = this;
		return {
			get width() {
				return self.document.width;
			},
			get height() {
				return self.document.height;
			},
			pixels: () => self.document.composite()
		};
	}

	/**
	 * Projects the current visible Reference Layer into the shell-facing underlay
	 * consumed by rendering, placement UI, and source-image sampling. Returns
	 * `undefined` when the document has no visible, readable Reference Layer; the
	 * getter does not mutate the document. The read is tied to `renderVersion` so
	 * consumers refresh after Reference placement, visibility, import, undo, or
	 * redo changes.
	 */
	get referenceLayerUnderlay(): ReferenceLayerUnderlay | undefined {
		// WASM Document internals are opaque to Svelte. Tie this projection to
		// renderVersion so import, fit-to-canvas, drag commits, undo/redo, and
		// visibility changes immediately refresh renderer consumers.
		void this.renderVersion;
		return this.#referenceLayerUnderlayProjector.project(this.document);
	}

	/**
	 * True when every layer's pixel buffer is fully transparent. Unlike
	 * `compositeBuffer.pixels()` this iterates every layer (including hidden
	 * ones), so painted-then-hidden content still counts as non-blank — the
	 * tab-close save prompt won't silently discard it.
	 */
	isDocumentBlank(): boolean {
		const doc = this.document;
		for (let i = 0; i < doc.layer_count(); i++) {
			const pixels = doc.layer_pixels_at(i);
			if (pixels && !isBlankCanvas(pixels)) {
				return false;
			}
		}
		return true;
	}

	#backend: CanvasBackend;
	#notifier: DirtyNotifier;
	#toolRunner: ToolRunner;
	#tabViewport: TabViewport;
	#documentChangeJournal: DocumentChangeJournal;
	#referenceLayerBlobs: Map<string, Blob>;
	#referenceLayerUnderlayProjector = new ReferenceLayerUnderlayProjector();
	#selectionPreviewBaselineMarquee: TabSnapshot['marquee'] | undefined = undefined;

	get viewport(): ViewportData {
		return this.#tabViewport.viewport;
	}

	get viewportSize(): ViewportSize {
		return this.#tabViewport.viewportSize;
	}

	get canUndo(): boolean {
		return this.#documentChangeJournal.canUndo;
	}

	get canRedo(): boolean {
		return this.#documentChangeJournal.canRedo;
	}

	get zoomPercent(): number {
		return Math.round(this.viewport.zoom * 100);
	}

	get marquee(): MarqueeRegion | undefined {
		// WASM Document internals are opaque to Svelte. Tie this projection to
		// renderVersion so marquee previews, commits, undo, and clear actions
		// refresh renderer consumers.
		void this.renderVersion;
		return this.document.marquee();
	}

	get isDrawing(): boolean {
		return this.#toolRunner.isDrawing;
	}

	constructor(deps: TabStateDeps) {
		this.#backend = deps.backend;
		this.#notifier = deps.notifier;
		this.shared = deps.shared;
		this.documentId = deps.documentId;
		this.name = deps.name;
		this.#referenceLayerBlobs = new Map(deps.referenceLayerBlobs ?? []);

		if (deps.document) {
			this.document = deps.document;
		} else {
			const cw = deps.canvasWidth ?? DEFAULT_CANVAS_DIMENSION;
			const ch = deps.canvasHeight ?? DEFAULT_CANVAS_DIMENSION;
			this.document = singleLayerDocument(cw, ch, new Uint8Array(cw * ch * 4));
		}
		this.canvasWidth = this.document.width;
		this.canvasHeight = this.document.height;

		let initialViewport: ViewportData;
		if (deps.viewport) {
			initialViewport = deps.viewport;
		} else {
			const vd = this.#backend.viewportOps.forCanvas(this.document.width, this.document.height);
			initialViewport = deps.gridColor ? { ...vd, gridColor: deps.gridColor } : vd;
		}

		const self = this;
		this.#tabViewport = new TabViewport({
			initial: initialViewport,
			initialViewportSize: DEFAULT_VIEWPORT_SIZE,
			getCanvasDimensions: () => ({
				width: self.document.width,
				height: self.document.height
			}),
			viewportOps: this.#backend.viewportOps,
			notifier: this.#notifier,
			documentId: this.documentId
		});

		this.samplingSession = createSamplingSession({
			getSamplingPort: () => {
				if (!isActiveLayerReference(self.document)) return createDocumentSamplingPort(self.document);
				const reference = self.referenceLayerUnderlay;
				if (!reference) {
					return createNoReadableSamplingPort(self.document.width, self.document.height);
				}
				return createReferenceLayerUnderlaySamplingPort(reference);
			},
			mapTarget: (coords) => {
				if (!isActiveLayerReference(self.document)) return coords;
				const reference = self.referenceLayerUnderlay;
				return reference ? referenceLayerUnderlaySourceCoords(reference, coords) : coords;
			}
		});
		this.referenceSamplingSession = createReferenceSamplingSession({
			decode: decodeReferenceBlob
		});

		this.#toolRunner = createToolRunner({
			host: {
				get document() {
					return self.document;
				},
				get foregroundColor() {
					return self.shared.foregroundColor;
				},
				get backgroundColor() {
					return self.shared.backgroundColor;
				}
			},
			shared: this.shared,
			getShiftHeld: deps.keyboard.getShiftHeld,
			samplingSession: this.samplingSession
		});
		this.#documentChangeJournal = new DocumentChangeJournal({
			getDocument: () => this.document,
			replaceDocument: (document) => {
				this.document = document;
			},
			createHistoryManager,
			rememberReferenceLayerBlob: (layerId, sourceBlob) => {
				this.#referenceLayerBlobs.set(layerId, sourceBlob);
			},
			clearActiveLayerPixels,
			resizeDocument: resizeDocumentWithAnchor,
			syncDocumentMetrics: () => {
				this.canvasWidth = this.document.width;
				this.canvasHeight = this.document.height;
			},
			reclampViewport: () => this.#reclampViewport(),
			invalidateRender: () => {
				this.renderVersion++;
			},
			markDirty: () => this.#notifier.markDirty(this.documentId)
		});
	}

	#applyEffects(effects: EditorEffects): void {
		let persistableChanged = false;
		for (const effect of effects) {
			switch (effect.type) {
				case 'captureUndoSnapshot':
					this.#documentChangeJournal.captureUndoSnapshot();
					break;
				case 'canvasChanged':
					this.#documentChangeJournal.recordCanvasChanged();
					break;
				case 'marqueePreviewChanged':
					this.#documentChangeJournal.recordPreviewChanged();
					break;
				case 'setMarquee':
					this.#documentChangeJournal.commit({
						kind: 'undoable-document',
						intent: { type: 'set-marquee', region: effect.region }
					});
					break;
				case 'colorPick':
					if (effect.target === 'foreground') {
						this.shared.foregroundColor = effect.color;
					} else {
						this.shared.backgroundColor = effect.color;
					}
					persistableChanged = true;
					break;
				case 'addRecentColor':
					this.shared.recentColors = addRecentColor(this.shared.recentColors, effect.hex);
					persistableChanged = true;
					break;
				default:
					assertNever(effect);
			}
		}
		if (persistableChanged) {
			this.#notifier.markDirty(this.documentId);
		}
	}

	drawStart = (button: number, pointerType: PointerType): void => {
		this.#selectionPreviewBaselineMarquee =
			this.shared.activeTool === 'selection' ? serializeMarquee(this.document.marquee()) : undefined;
		this.#applyEffects(this.#toolRunner.drawStart(button, pointerType));
	};

	draw = (current: CanvasPoint, previous: CanvasPoint | null): void => {
		this.#applyEffects(this.#toolRunner.draw(current, previous));
	};

	drawEnd = (): void => {
		this.#selectionPreviewBaselineMarquee = undefined;
		this.#applyEffects(this.#toolRunner.drawEnd());
	};

	drawCancel = (): void => {
		this.#applyEffects(this.#toolRunner.drawCancel());
		this.#selectionPreviewBaselineMarquee = undefined;
	};

	modifierChanged = (): void => {
		this.#applyEffects(this.#toolRunner.modifierChanged());
	};

	sampleStart = (
		coords: CanvasPoint,
		button: number,
		pointerType: PointerType
	): boolean => {
		// Eyedropper already runs sampling through its draw lifecycle, so a
		// long-press on top of it would double-start.
		if (this.shared.activeTool === 'eyedropper') return false;
		this.samplingSession.start({
			targetPixel: coords,
			commitTarget: button === 2 ? 'background' : 'foreground',
			inputSource: pointerType === 'touch' ? 'touch' : 'mouse'
		});
		return true;
	};

	sampleUpdate = (coords: CanvasPoint): void => {
		this.samplingSession.update(coords);
	};

	sampleEnd = (): void => {
		this.#applyEffects(this.samplingSession.commit());
	};

	sampleCancel = (): void => {
		this.samplingSession.cancel();
	};

	referenceSampleStart = async (
		blob: Blob,
		imageX: number,
		imageY: number,
		inputSource: LoupeInputSource
	): Promise<void> => {
		this.#applyEffects(
			await this.referenceSamplingSession.start(blob, { x: imageX, y: imageY }, inputSource)
		);
	};

	referenceSampleMove = (imageX: number, imageY: number): void => {
		this.#applyEffects(this.referenceSamplingSession.move({ x: imageX, y: imageY }));
	};

	referenceSampleEnd = (): void => {
		this.#applyEffects(this.referenceSamplingSession.end());
	};

	undo = (): void => {
		if (this.isDrawing) return;
		this.#documentChangeJournal.undo();
	};

	redo = (): void => {
		if (this.isDrawing) return;
		this.#documentChangeJournal.redo();
	};

	clear = (): void => {
		if (this.isDrawing) return;
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'clear-active-layer' }
		});
	};

	clearMarquee = (): void => {
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'set-marquee', region: null }
		});
	};

	clearMarqueePixels = (): void => {
		if (this.isDrawing) return;
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'clear-marquee-pixels' }
		});
	};

	pushHistorySnapshot = (): void => {
		this.#documentChangeJournal.captureUndoSnapshot();
	};

	addLayer = (name: string): void => {
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'add-pixel-layer', name }
		});
	};

	/**
	 * Sets or replaces the document's singleton Reference Layer from a decoded
	 * source image. The previous Reference document state remains undoable, so
	 * old source blobs stay cached even after a successful replacement.
	 */
	setReferenceLayer = (source: ReferenceLayerSource): string => {
		const result = this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'set-reference-layer', source }
		});
		if (!result.changed || !result.layerId) {
			throw new Error('Reference Layer change did not produce a layer id');
		}
		return result.layerId;
	};

	/**
	 * Removes the layer with `id`. No-op when only one layer remains (last-layer
	 * guard parallels the UI's disabled affordance and keeps history clean — no
	 * snapshot is pushed in that branch). When the removed layer was active, the
	 * active pointer moves to an adjacent layer (delegated to the core). Pushes
	 * an undo snapshot, bumps `renderVersion`, and marks the tab dirty. Throws
	 * if `id` does not refer to an existing layer.
	 */
	removeLayer = (id: string): void => {
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'remove-layer', id }
		});
	};

	setActiveLayer = (id: string): void => {
		this.#documentChangeJournal.commit({
			kind: 'persisted-document-ui',
			intent: { type: 'set-active-layer', id }
		});
	};

	/**
	 * Moves the layer with `id` to `newVisualIndex` in **panel order** (top of
	 * panel = visual 0). Translates visual→stack via
	 * `stack_idx = (layer_count - 1) - visual_idx` and delegates to the core.
	 * No-op when the layer is already at that visual position (no snapshot, no
	 * renderVersion bump, no markDirty — keeps history clean and parallels the
	 * `removeLayer` last-layer guard pattern). Pushes an undo snapshot on the
	 * real-move branch and bumps `renderVersion`. Throws if `id` does not refer
	 * to an existing layer.
	 */
	reorderLayer = (id: string, newVisualIndex: number): void => {
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'reorder-layer', id, newVisualIndex }
		});
	};

	/**
	 * Sets the visibility flag of the layer with `id`. No-op when the layer's
	 * `visible` is already `visible` (no snapshot, no renderVersion bump, no
	 * markDirty — keeps history clean and parallels the `setActiveLayer`
	 * idempotency pattern). On a real change, pushes an undo snapshot, bumps
	 * `renderVersion`, and marks the tab dirty. Throws if `id` does not refer
	 * to an existing layer.
	 */
	setLayerVisibility = (id: string, visible: boolean): void => {
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'set-layer-visibility', id, visible }
		});
	};

	/**
	 * Moves a Reference Layer's source image in canvas pixel space. `placement.x`
	 * and `placement.y` are document-pixel coordinates; `placement.scale` must
	 * be finite and positive. No-ops when unchanged. On a real change, records an
	 * undo snapshot, updates the document, bumps `renderVersion`, and marks this
	 * tab dirty. Throws when `id` does not exist or is not a Reference Layer.
	 */
	setReferencePlacement = (id: string, placement: ReferencePlacement): void => {
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'set-reference-placement', id, placement }
		});
	};

	fitReferenceLayerToCanvas = (id: string): void => {
		const stackIdx = this.#stackIndexOf(id);
		const current = this.document.layer_placement_at(stackIdx);
		const dimensions = this.document.layer_source_dimensions_at(stackIdx);
		if (!current || !dimensions) {
			throw new Error(`Layer with id ${id} is not a Reference Layer`);
		}
		this.setReferencePlacement(
			id,
			fitReferencePlacementToCanvas(
				this.document.width,
				this.document.height,
				dimensions[0],
				dimensions[1]
			)
		);
	};

	#stackIndexOf(id: string): number {
		const doc = this.document;
		const count = doc.layer_count();
		for (let i = 0; i < count; i++) {
			if (doc.layer_id_at(i) === id) return i;
		}
		throw new Error(`Layer with id ${id} not found`);
	}

	#navigationBounds(): DocumentNavigationBounds {
		const canvasBounds: DocumentNavigationBounds = {
			minX: 0,
			minY: 0,
			maxX: this.document.width,
			maxY: this.document.height
		};
		const activeLayerId = this.document.active_layer_id();
		for (let i = 0; i < this.document.layer_count(); i++) {
			if (this.document.layer_id_at(i) !== activeLayerId) continue;
			if (this.document.layer_kind_at(i) !== 'reference') return canvasBounds;
			const underlay = this.referenceLayerUnderlay;
			if (!underlay) return canvasBounds;
			const referenceBounds = referenceLayerUnderlayBounds(underlay);
			return {
				minX: Math.min(canvasBounds.minX, referenceBounds.minX),
				minY: Math.min(canvasBounds.minY, referenceBounds.minY),
				maxX: Math.max(canvasBounds.maxX, referenceBounds.maxX),
				maxY: Math.max(canvasBounds.maxY, referenceBounds.maxY)
			};
		}
		return canvasBounds;
	}

	#clampViewportToNavigationBounds(viewport: ViewportData): ViewportData {
		const bounds = this.#navigationBounds();
		return this.#backend.viewportOps.clampPanToDocumentBounds(
			viewport,
			bounds.minX,
			bounds.minY,
			bounds.maxX,
			bounds.maxY,
			this.viewportSize.width,
			this.viewportSize.height
		);
	}

	#reclampViewport(): void {
		const clamped = this.#clampViewportToNavigationBounds(this.viewport);
		if (clamped.panX === this.viewport.panX && clamped.panY === this.viewport.panY) return;
		this.#tabViewport.apply(clamped);
	}

	setViewport = (newViewport: ViewportData): void => {
		this.#tabViewport.apply(this.#clampViewportToNavigationBounds(newViewport));
	};

	setViewportSize = (size: ViewportSize): void => {
		this.#tabViewport.setViewportSize(size);
	};

	zoomIn = (): void => {
		this.#tabViewport.zoomIn();
	};

	zoomOut = (): void => {
		this.#tabViewport.zoomOut();
	};

	zoomReset = (): void => {
		this.#tabViewport.zoomReset();
	};

	zoomFit = (maxZoom: number = Infinity): void => {
		this.#tabViewport.zoomFit(maxZoom);
	};

	toggleGrid = (): void => {
		this.#tabViewport.toggleGrid();
	};

	resize = (newWidth: number, newHeight: number): void => {
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: {
				type: 'resize-document',
				width: newWidth,
				height: newHeight,
				anchor: this.resizeAnchor
			}
		});
	};

	toggleExportUI = (): void => {
		this.isExportUIOpen = !this.isExportUIOpen;
	};

	/**
	 * Sets the persisted timeline-panel collapsed flag on the underlying
	 * document and marks the tab dirty so the new value reaches storage. The
	 * change is **not** undoable — panel layout is incidental to the artwork.
	 */
	setTimelinePanelCollapsed = (collapsed: boolean): void => {
		this.#documentChangeJournal.commit({
			kind: 'persisted-document-ui',
			intent: { type: 'set-timeline-panel-collapsed', collapsed }
		});
	};

	/**
	 * Builds a fresh `PixelCanvas` from `document.composite_for_export()` —
	 * used by exporters that need `encode_png` / `encode_svg`. The buffer is a
	 * one-shot snapshot; callers must not retain it across mutations.
	 */
	exportableSnapshot = (): PixelCanvas => {
		return this.#backend.canvasFactory.fromPixels(
			this.document.width,
			this.document.height,
			this.document.composite_for_export()
		);
	};

	exportPng = (): void => {
		try {
			exportAsPng(this.exportableSnapshot());
		} catch (error) {
			console.error('PNG export failed:', error);
		}
	};

	toSnapshot = (): TabSnapshot => {
		const doc = this.document;
		const layerCount = doc.layer_count();
		const layers = Array.from({ length: layerCount }, (_, i) => {
			const id = doc.layer_id_at(i)!;
			const common = {
				id,
				name: doc.layer_name_at(i)!,
				visible: doc.layer_visible_at(i)!,
				opacity: doc.layer_opacity_at(i)!
			};
			if (doc.layer_kind_at(i) === 'reference') {
				const sourceBlob = this.#referenceLayerBlobs.get(id);
				if (!sourceBlob) {
					throw new Error(`Missing source blob for Reference Layer ${id}`);
				}
				const dimensions = doc.layer_source_dimensions_at(i)!;
				const placement = doc.layer_placement_at(i)!;
				return {
					kind: 'reference',
					...common,
					sourceBlob,
					sourceRgba: doc.layer_source_pixels_at(i)!.slice(),
					naturalWidth: dimensions[0],
					naturalHeight: dimensions[1],
					placement: {
						x: placement.x,
						y: placement.y,
						scale: placement.scale
					}
				} satisfies ReferenceLayerSnapshot;
			}
			return {
				kind: 'pixel' as const,
				...common,
				pixels: doc.layer_pixels_at(i)!.slice()
			};
		});
		const marquee =
			this.#selectionPreviewBaselineMarquee === undefined
				? serializeMarquee(doc.marquee())
				: this.#selectionPreviewBaselineMarquee;
		return {
			id: this.documentId,
			name: this.name,
			width: doc.width,
			height: doc.height,
			marquee,
			layers,
			activeLayerId: doc.active_layer_id(),
			nextLayerNumber: doc.next_layer_number(),
			timelinePanelCollapsed: doc.is_timeline_panel_collapsed(),
			viewport: { ...this.viewport }
		};
	};
}
