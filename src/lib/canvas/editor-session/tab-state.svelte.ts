import type {
	Document,
	PixelCanvas,
	CanvasCoords,
	ResizeAnchor,
	ReferencePlacement
} from '../canvas-model';
import {
	fitReferencePlacementToCanvas,
	resizeDocumentWithAnchor,
	singleLayerDocument
} from '../wasm-backend';
import { isBlankCanvas } from '../blank-detection';
import type { ViewportData, ViewportSize } from '../viewport';
import { addRecentColor } from '../color';
import type { ReferenceUnderlay } from '../renderer';
import type { SharedState } from '../shared-state.svelte';
import { decodeReferenceBlob } from '../../reference-images/decode-reference-blob';
import {
	createReferenceSamplingSession,
	type ReferenceSamplingSession
} from '../../reference-images/reference-sampling-session.svelte';
import { createSamplingSession, type SamplingSession } from '../sampling/session.svelte';
import type { LoupeInputSource } from '../sampling/types';
import { createToolRunner, type ToolRunner, type EditorEffects } from '../tool-runner.svelte';
import { exportAsPng } from '../export';
import type { PointerType } from '../canvas-interaction.svelte';
import type { ReferenceLayerSnapshot, TabSnapshot } from '../workspace-snapshot';
import type { CanvasBackend } from './canvas-backend';
import type { DirtyNotifier } from './dirty-notifier';
import { TabViewport } from './tab-viewport.svelte';

function assertNever(x: never): never {
	throw new Error(`Unhandled effect type: ${(x as { type: string }).type}`);
}

interface CachedReferenceUnderlaySource {
	readonly document: Document;
	readonly layerId: string;
	readonly sourceFingerprint: string;
	readonly naturalWidth: number;
	readonly naturalHeight: number;
	readonly sourceKey: string;
	readonly sourceRgba: Uint8Array;
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

/**
 * Decoded image payload used to set or replace a document's singleton Reference
 * Layer. Callers provide a human-readable name, the original source `Blob` for
 * persistence, and an RGBA buffer whose byte length must equal
 * `naturalWidth * naturalHeight * 4`; dimensions must be positive image-pixel
 * sizes before `setReferenceLayer` accepts the source.
 */
export interface ReferenceLayerSource {
	readonly name: string;
	readonly sourceBlob: Blob;
	readonly sourceRgba: Uint8Array | Uint8ClampedArray;
	readonly naturalWidth: number;
	readonly naturalHeight: number;
}

const DEFAULT_CANVAS_DIMENSION = 16;
const DEFAULT_VIEWPORT_SIZE: ViewportSize = { width: 512, height: 512 };

/**
 * Per-tab editor state. Owns canvas, viewport, history, sampling session,
 * and a tab-scoped tool runner. References (does not own) the workspace's
 * `SharedState` so changes to active tool / colors propagate across tabs.
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
	 * exposed separately through `referenceUnderlay` so the renderer can draw
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

	get referenceUnderlay(): ReferenceUnderlay | undefined {
		// WASM Document internals are opaque to Svelte. Tie this projection to
		// renderVersion so import, fit-to-canvas, drag commits, undo/redo, and
		// visibility changes immediately refresh renderer consumers.
		void this.renderVersion;
		const doc = this.document;
		for (let i = 0; i < doc.layer_count(); i++) {
			if (doc.layer_kind_at(i) !== 'reference') continue;
			if (!doc.layer_visible_at(i)) return undefined;
			const layerId = doc.layer_id_at(i);
			const sourceFingerprint = doc.layer_source_fingerprint_at(i);
			const dimensions = doc.layer_source_dimensions_at(i);
			const placement = doc.layer_placement_at(i);
			const opacity = doc.layer_opacity_at(i);
			if (!layerId || !sourceFingerprint || !dimensions || !placement || opacity === undefined) {
				return undefined;
			}
			const naturalWidth = dimensions[0];
			const naturalHeight = dimensions[1];
			const cached = this.#referenceUnderlaySource;
			let source =
				cached?.document === doc &&
				cached.layerId === layerId &&
				cached.sourceFingerprint === sourceFingerprint &&
				cached.naturalWidth === naturalWidth &&
				cached.naturalHeight === naturalHeight
					? cached
					: undefined;
			if (!source) {
				const sourceRgba = doc.layer_source_pixels_at(i);
				if (!sourceRgba) return undefined;
				source = {
					document: doc,
					layerId,
					sourceFingerprint,
					naturalWidth,
					naturalHeight,
					sourceKey: `${layerId}:${naturalWidth}x${naturalHeight}:${sourceFingerprint}`,
					sourceRgba
				};
				this.#referenceUnderlaySource = source;
			}
			return {
				sourceKey: source.sourceKey,
				sourceRgba: source.sourceRgba,
				naturalWidth,
				naturalHeight,
				placement: {
					x: placement.x,
					y: placement.y,
					scale: placement.scale
				},
				opacity
			};
		}
		return undefined;
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
	#referenceLayerBlobs: Map<string, Blob>;
	#referenceUnderlaySource?: CachedReferenceUnderlaySource;

	get viewport(): ViewportData {
		return this.#tabViewport.viewport;
	}

	get viewportSize(): ViewportSize {
		return this.#tabViewport.viewportSize;
	}

	get canUndo(): boolean {
		return this.#toolRunner.canUndo;
	}

	get canRedo(): boolean {
		return this.#toolRunner.canRedo;
	}

	get zoomPercent(): number {
		return Math.round(this.viewport.zoom * 100);
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

		this.samplingSession = createSamplingSession({ getSamplingPort: () => self.document });
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
	}

	#applyEffects(effects: EditorEffects): void {
		let persistableChanged = false;
		for (const effect of effects) {
			switch (effect.type) {
				case 'canvasChanged':
					this.renderVersion++;
					persistableChanged = true;
					break;
				case 'documentReplaced':
					this.document = effect.document;
					this.canvasWidth = effect.document.width;
					this.canvasHeight = effect.document.height;
					this.#reclampViewport();
					this.renderVersion++;
					persistableChanged = true;
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
		this.#applyEffects(this.#toolRunner.drawStart(button, pointerType));
	};

	draw = (current: CanvasCoords, previous: CanvasCoords | null): void => {
		this.#applyEffects(this.#toolRunner.draw(current, previous));
	};

	drawEnd = (): void => {
		this.#applyEffects(this.#toolRunner.drawEnd());
	};

	modifierChanged = (): void => {
		this.#applyEffects(this.#toolRunner.modifierChanged());
	};

	sampleStart = (
		coords: CanvasCoords,
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

	sampleUpdate = (coords: CanvasCoords): void => {
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
		this.#applyEffects(this.#toolRunner.undo());
	};

	redo = (): void => {
		this.#applyEffects(this.#toolRunner.redo());
	};

	clear = (): void => {
		this.#applyEffects(this.#toolRunner.clear());
	};

	pushHistorySnapshot = (): void => {
		this.#toolRunner.pushSnapshot();
	};

	addLayer = (name: string): void => {
		this.#toolRunner.pushSnapshot();
		this.document.add_layer(crypto.randomUUID(), name);
		this.renderVersion++;
		this.#notifier.markDirty(this.documentId);
	};

	/**
	 * Sets or replaces the document's singleton Reference Layer from a decoded
	 * source image. The previous Reference document state remains undoable, so
	 * old source blobs stay cached even after a successful replacement.
	 */
	setReferenceLayer = (source: ReferenceLayerSource): string => {
		if (source.naturalWidth <= 0 || source.naturalHeight <= 0) {
			throw new Error('Reference Layer source dimensions must be positive');
		}
		if (source.sourceRgba.length !== source.naturalWidth * source.naturalHeight * 4) {
			throw new Error('Reference Layer source RGBA length must match dimensions');
		}
		const id = crypto.randomUUID();
		this.#toolRunner.pushSnapshot();
		this.document.add_reference_layer(
			id,
			source.name,
			new Uint8Array(source.sourceRgba),
			source.naturalWidth,
			source.naturalHeight
		);
		this.#referenceLayerBlobs.set(id, source.sourceBlob);
		this.#referenceUnderlaySource = undefined;
		this.#reclampViewport();
		this.renderVersion++;
		this.#notifier.markDirty(this.documentId);
		return id;
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
		if (this.document.layer_count() === 1) return;
		this.#toolRunner.pushSnapshot();
		this.document.remove_layer(id);
		this.#reclampViewport();
		this.renderVersion++;
		this.#notifier.markDirty(this.documentId);
	};

	setActiveLayer = (id: string): void => {
		if (id === this.document.active_layer_id()) return;
		this.document.set_active_layer(id);
		this.#reclampViewport();
		this.renderVersion++;
		this.#notifier.markDirty(this.documentId);
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
		const count = this.document.layer_count();
		const targetStackIdx = count - 1 - newVisualIndex;
		const currentStackIdx = this.#stackIndexOf(id);
		if (this.document.layer_kind_at(currentStackIdx) === 'reference') return;
		const effectiveTargetStackIdx =
			this.document.layer_kind_at(0) === 'reference' ? Math.max(1, targetStackIdx) : targetStackIdx;
		if (currentStackIdx === effectiveTargetStackIdx) return;
		this.#toolRunner.pushSnapshot();
		this.document.reorder_layer(id, effectiveTargetStackIdx);
		this.renderVersion++;
		this.#notifier.markDirty(this.documentId);
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
		const stackIdx = this.#stackIndexOf(id);
		if (this.document.layer_visible_at(stackIdx) === visible) return;
		this.#toolRunner.pushSnapshot();
		this.document.set_layer_visibility(id, visible);
		this.#reclampViewport();
		this.renderVersion++;
		this.#notifier.markDirty(this.documentId);
	};

	/**
	 * Moves a Reference Layer's source image in canvas pixel space. `placement.x`
	 * and `placement.y` are document-pixel coordinates; `placement.scale` must
	 * be finite and positive. No-ops when unchanged. On a real change, records an
	 * undo snapshot, updates the document, bumps `renderVersion`, and marks this
	 * tab dirty. Throws when `id` does not exist or is not a Reference Layer.
	 */
	setReferencePlacement = (id: string, placement: ReferencePlacement): void => {
		const stackIdx = this.#stackIndexOf(id);
		const current = this.document.layer_placement_at(stackIdx);
		if (!current) {
			throw new Error(`Layer with id ${id} is not a Reference Layer`);
		}
		if (
			current.x === placement.x &&
			current.y === placement.y &&
			current.scale === placement.scale
		) {
			return;
		}
		this.#toolRunner.pushSnapshot();
		this.document.set_reference_placement(id, placement.x, placement.y, placement.scale);
		this.#reclampViewport();
		this.renderVersion++;
		this.#notifier.markDirty(this.documentId);
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
			if (!this.document.layer_visible_at(i)) return canvasBounds;
			const dimensions = this.document.layer_source_dimensions_at(i);
			const placement = this.document.layer_placement_at(i);
			if (!dimensions || !placement) return canvasBounds;
			const referenceBounds = {
				minX: placement.x,
				minY: placement.y,
				maxX: placement.x + dimensions[0] * placement.scale,
				maxY: placement.y + dimensions[1] * placement.scale
			};
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
		if (newWidth === this.document.width && newHeight === this.document.height) return;
		this.#toolRunner.pushSnapshot();
		resizeDocumentWithAnchor(this.document, newWidth, newHeight, this.resizeAnchor);
		this.canvasWidth = newWidth;
		this.canvasHeight = newHeight;
		this.#reclampViewport();
		this.renderVersion++;
		this.#notifier.markDirty(this.documentId);
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
		if (this.document.is_timeline_panel_collapsed() === collapsed) return;
		this.document.set_timeline_panel_collapsed(collapsed);
		this.renderVersion++;
		this.#notifier.markDirty(this.documentId);
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
		return {
			id: this.documentId,
			name: this.name,
			width: doc.width,
			height: doc.height,
			layers,
			activeLayerId: doc.active_layer_id(),
			nextLayerNumber: doc.next_layer_number(),
			timelinePanelCollapsed: doc.is_timeline_panel_collapsed(),
			viewport: { ...this.viewport }
		};
	};
}
