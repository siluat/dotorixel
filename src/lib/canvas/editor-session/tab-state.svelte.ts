import type {
	Document,
	PixelCanvas,
	CanvasCoords,
	CanvasPoint,
	MarqueeRegion,
	ResizeAnchor,
	ReferencePlacement,
	SelectionClipboardData
} from '../canvas-model';
import {
	clearActiveLayerPixels,
	createHistoryManager,
	fitReferencePlacementToCanvas,
	marqueeRegionFromDrag,
	resizeDocumentWithAnchor,
	singleLayerDocument
} from '../wasm-backend';
import { isBlankCanvas } from '../blank-detection';
import type { ViewportData, ViewportSize } from '../viewport';
import type { NavigationBounds } from '../navigation-bounds';
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
import { createCanvasSamplingSession, type CanvasSamplingSession } from '../sampling/session.svelte';
import type { LoupeInputSource } from '../sampling/types';
import { createToolRunner, type ToolRunner, type EditorEffects } from '../tool-runner.svelte';
import { exportAsPng } from '../export';
import type { PointerType } from '../canvas-interaction.svelte';
import type { ReferenceLayerSnapshot, TabSnapshot } from '../workspace-snapshot';
import {
	DocumentLayerProjection,
	type DocumentLayerProjectionRead
} from '../document-layer-projection';
import {
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
import {
	type CommitFloatingSelectionIntent,
	FloatingSelectionLifecycle,
	type FloatingSelectionOffset
} from './floating-selection-lifecycle';
import { TabViewport } from './tab-viewport.svelte';

export type { ReferenceLayerSource } from './document-change-journal.svelte';

function assertNever(x: never): never {
	throw new Error(`Unhandled effect type: ${(x as { type: string }).type}`);
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

function isPointInsideMarquee(point: CanvasPoint, marquee: MarqueeRegion): boolean {
	return (
		point.x >= marquee.x &&
		point.y >= marquee.y &&
		point.x < marquee.x + marquee.width &&
		point.y < marquee.y + marquee.height
	);
}

interface DocumentRect {
	readonly minX: number;
	readonly minY: number;
	readonly maxX: number;
	readonly maxY: number;
}

interface SelectionCutSnapshot {
	readonly clipboard: SelectionClipboardData | null;
	readonly shouldClearPixels: boolean;
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
	readonly samplingSession: CanvasSamplingSession;
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
			pixels: () => self.#floatingSelection.previewPixels()
		};
	}

	/**
	 * Projects the current Document Layer stack into the shell-facing read model.
	 * The read is tied to `renderVersion` so consumers refresh after Reference
	 * placement, visibility, import, undo, redo, and layer stack changes.
	 */
	get layerProjection(): DocumentLayerProjectionRead {
		const renderVersion = this.renderVersion;
		const cached = this.#layerProjectionCache;
		if (cached?.document === this.document && cached.renderVersion === renderVersion) {
			return cached.read;
		}
		const read = this.#documentLayerProjection.read(this.document);
		this.#layerProjectionCache = {
			document: this.document,
			renderVersion,
			read
		};
		return read;
	}

	/**
	 * Projects the current visible Reference Layer into the shell-facing underlay
	 * consumed by rendering, placement UI, and source-image sampling. Returns
	 * `undefined` when the document has no visible, readable Reference Layer.
	 */
	get referenceLayerUnderlay(): ReferenceLayerUnderlay | undefined {
		return this.layerProjection.referenceLayerUnderlay;
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
	#documentLayerProjection = new DocumentLayerProjection();
	#layerProjectionCache?: {
		readonly document: Document;
		readonly renderVersion: number;
		readonly read: DocumentLayerProjectionRead;
	};
	#selectionPreviewBaselineMarquee: TabSnapshot['marquee'] | undefined = undefined;
	#floatingSelection = new FloatingSelectionLifecycle({
		getDocument: () => this.document,
		applyCommit: (intent) => this.#commitFloatingSelectionIntent(intent)
	});

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

	get floatingSelectionOffset(): FloatingSelectionOffset | undefined {
		void this.renderVersion;
		return this.#floatingSelection.offset;
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
			getReferenceFootprint: () => self.#activeReferenceFootprint(),
			viewportOps: this.#backend.viewportOps,
			notifier: this.#notifier,
			documentId: this.documentId
		});

		this.samplingSession = createCanvasSamplingSession({
			getSamplingPort: () => {
				const projection = self.layerProjection;
				if (projection.activeLayerKind !== 'reference') {
					return createDocumentSamplingPort(self.document);
				}
				const reference = projection.referenceLayerUnderlay;
				if (!reference) {
					return createNoReadableSamplingPort(self.document.width, self.document.height);
				}
				return createReferenceLayerUnderlaySamplingPort(reference);
			},
			mapTarget: (coords) => {
				const projection = self.layerProjection;
				if (projection.activeLayerKind !== 'reference') return coords;
				const reference = projection.referenceLayerUnderlay;
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
			getLayerProjection: () => this.#documentLayerProjection.read(this.document),
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
			reclampViewport: () => {
				this.#clearLayerProjectionCache();
				this.#tabViewport.reclamp();
			},
			invalidateRender: () => {
				this.#clearLayerProjectionCache();
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
				case 'beginFloatingSelection':
					this.#recordFloatingPreviewChanged(
						this.#floatingSelection.liftFromMarquee(effect.sourceRegion)
					);
					break;
				case 'moveFloatingSelection':
					this.#recordFloatingPreviewChanged(this.#floatingSelection.moveTo(effect.offset));
					break;
				case 'commitFloatingSelection':
					this.#commitFloatingSelection();
					break;
				case 'cancelFloatingSelection':
					this.#recordFloatingPreviewChanged(this.#floatingSelection.cancel());
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

	#recordFloatingPreviewChanged(changed: boolean): void {
		if (changed) {
			this.#documentChangeJournal.recordPreviewChanged();
		}
	}

	#clearLayerProjectionCache(): void {
		this.#layerProjectionCache = undefined;
	}

	#commitFloatingSelectionIntent(intent: CommitFloatingSelectionIntent): void {
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent
		});
	}

	#commitFloatingSelection(): void {
		this.#floatingSelection.commit();
	}

	#commitIdleFloatingSelection(): void {
		if (this.isDrawing) return;
		this.#commitFloatingSelection();
	}

	#visibleCanvasRect(): DocumentRect | null {
		const topLeft = this.#backend.viewportOps.screenToCanvasPoint(this.viewport, 0, 0);
		const bottomRight = this.#backend.viewportOps.screenToCanvasPoint(
			this.viewport,
			this.viewportSize.width,
			this.viewportSize.height
		);
		const minX = Math.max(0, Math.min(topLeft.x, bottomRight.x));
		const minY = Math.max(0, Math.min(topLeft.y, bottomRight.y));
		const maxX = Math.min(this.document.width, Math.max(topLeft.x, bottomRight.x));
		const maxY = Math.min(this.document.height, Math.max(topLeft.y, bottomRight.y));

		return minX < maxX && minY < maxY ? { minX, minY, maxX, maxY } : null;
	}

	#pasteDestinationRegion(width: number, height: number): MarqueeRegion {
		const visible = this.#visibleCanvasRect();
		const center = visible
			? {
					x: (visible.minX + visible.maxX) / 2,
					y: (visible.minY + visible.maxY) / 2
				}
			: {
					x: this.document.width / 2,
					y: this.document.height / 2
				};
		const x = Math.floor(center.x - width / 2);
		const y = Math.floor(center.y - height / 2);
		return marqueeRegionFromDrag(x, y, x + width - 1, y + height - 1);
	}

	drawStart = (button: number, pointerType: PointerType): void => {
		const effects = this.#floatingSelection.withDrawStartPolicy(
			this.shared.activeTool === 'selection',
			() => this.#toolRunner.drawStart(button, pointerType)
		);
		this.#selectionPreviewBaselineMarquee =
			this.shared.activeTool === 'selection' ? serializeMarquee(this.document.marquee()) : undefined;
		this.#applyEffects(effects);
	};

	draw = (current: CanvasPoint, previous: CanvasPoint | null): void => {
		if (
			this.layerProjection.activeLayerKind !== 'reference' &&
			this.#floatingSelection.commitIfSelectionDragStartsOutside(current, previous)
		) {
			this.#selectionPreviewBaselineMarquee =
				this.shared.activeTool === 'selection'
					? serializeMarquee(this.document.marquee())
					: undefined;
		}
		this.#applyEffects(this.#toolRunner.draw(current, previous));
	};

	drawEnd = (): void => {
		this.#selectionPreviewBaselineMarquee = undefined;
		this.#applyEffects(this.#toolRunner.drawEnd());
		this.#floatingSelection.endSelectionDrag();
	};

	drawCancel = (): void => {
		this.#applyEffects(this.#toolRunner.drawCancel());
		this.#selectionPreviewBaselineMarquee = undefined;
		this.#floatingSelection.endSelectionDrag();
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
		const activeMarquee = this.document.marquee();
		if (
			pointerType === 'touch' &&
			this.shared.activeTool === 'selection' &&
			activeMarquee &&
			isPointInsideMarquee(coords, activeMarquee)
		) {
			return false;
		}
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
		if (this.#floatingSelection.isActive) {
			this.#recordFloatingPreviewChanged(this.#floatingSelection.cancel());
			return;
		}
		this.#documentChangeJournal.undo();
	};

	redo = (): void => {
		if (this.isDrawing) return;
		if (this.#floatingSelection.isActive) return;
		this.#documentChangeJournal.redo();
	};

	clear = (): void => {
		if (this.isDrawing) return;
		this.#commitIdleFloatingSelection();
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'clear-active-layer' }
		});
	};

	clearMarquee = (): void => {
		this.#commitIdleFloatingSelection();
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'set-marquee', region: null }
		});
	};

	clearMarqueeOrFloating = (): void => {
		if (this.#floatingSelection.isActive) {
			if (this.isDrawing) {
				this.drawCancel();
			} else {
				this.#recordFloatingPreviewChanged(this.#floatingSelection.cancel());
			}
			return;
		}
		if (this.isDrawing) return;
		this.clearMarquee();
	};

	clearMarqueePixels = (): void => {
		if (this.isDrawing) return;
		this.#commitIdleFloatingSelection();
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'clear-marquee-pixels' }
		});
	};

	flipHorizontal = (): void => {
		if (this.isDrawing) return;
		this.#commitIdleFloatingSelection();
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'flip-horizontal' }
		});
	};

	flipVertical = (): void => {
		if (this.isDrawing) return;
		this.#commitIdleFloatingSelection();
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'flip-vertical' }
		});
	};

	nudgeMarquee = (dx: number, dy: number): void => {
		if (this.isDrawing) return;
		if (this.layerProjection.activeLayerKind === 'reference') return;
		this.#recordFloatingPreviewChanged(this.#floatingSelection.nudgeMarquee({ dx, dy }));
	};

	commitFloatingSelection = (): void => {
		if (this.isDrawing) return;
		this.#commitFloatingSelection();
	};

	duplicateFloatingSelection = (): void => {
		if (this.isDrawing) return;
		this.#recordFloatingPreviewChanged(this.#floatingSelection.duplicate());
	};

	pasteSelectionClipboard = (clipboard: SelectionClipboardData): void => {
		if (this.isDrawing) return;
		if (this.layerProjection.activeLayerKind === 'reference') return;
		if (clipboard.width <= 0 || clipboard.height <= 0 || clipboard.pixels.length === 0) return;
		if (clipboard.pixels.length !== clipboard.width * clipboard.height * 4) return;

		const sourceRegion = this.#pasteDestinationRegion(clipboard.width, clipboard.height);
		this.#recordFloatingPreviewChanged(
			this.#floatingSelection.pasteClipboard(clipboard, sourceRegion)
		);
	};

	selectionClipboardSnapshot = (): SelectionClipboardData | null => {
		return this.#floatingSelection.clipboardSnapshot();
	};

	selectionCutSnapshot = (): SelectionCutSnapshot | null => {
		if (this.layerProjection.activeLayerKind === 'reference') return null;

		const marquee = this.document.marquee();
		if (!marquee) return null;

		if (!marquee.clip_to(this.document.width, this.document.height)) {
			return { clipboard: null, shouldClearPixels: false };
		}

		return {
			clipboard: {
				pixels: this.document.lift_marquee_pixels(),
				width: marquee.width,
				height: marquee.height
			},
			shouldClearPixels: true
		};
	};

	pushHistorySnapshot = (): void => {
		this.#documentChangeJournal.captureUndoSnapshot();
	};

	addLayer = (name: string): void => {
		this.#commitIdleFloatingSelection();
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
		this.#commitIdleFloatingSelection();
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
		this.#commitIdleFloatingSelection();
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'remove-layer', id }
		});
	};

	setActiveLayer = (id: string): void => {
		this.#commitIdleFloatingSelection();
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
		this.#commitIdleFloatingSelection();
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
		this.#commitIdleFloatingSelection();
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
		this.#commitIdleFloatingSelection();
		this.#documentChangeJournal.commit({
			kind: 'undoable-document',
			intent: { type: 'set-reference-placement', id, placement }
		});
	};

	fitReferenceLayerToCanvas = (id: string): void => {
		const stackIdx = this.layerProjection.stackIndexById.get(id);
		if (stackIdx === undefined) {
			throw new Error(`Layer with id ${id} not found`);
		}
		const record = this.document.layers_metadata()[stackIdx];
		if (
			record === undefined ||
			record.natural_width === undefined ||
			record.natural_height === undefined
		) {
			throw new Error(`Layer with id ${id} is not a Reference Layer`);
		}
		this.setReferencePlacement(
			id,
			fitReferencePlacementToCanvas(
				this.document.width,
				this.document.height,
				record.natural_width,
				record.natural_height
			)
		);
	};

	/**
	 * The active Reference Layer's visible underlay footprint in canvas-pixel
	 * coordinates, or `null` when the active layer is not a visible Reference
	 * Layer. Supplied to `TabViewport` as the projection-coupled input to
	 * Navigation Bounds; the viewport module owns the clamp itself.
	 */
	#activeReferenceFootprint(): NavigationBounds | null {
		const projection = this.layerProjection;
		if (projection.activeLayerKind !== 'reference') return null;
		const underlay = projection.referenceLayerUnderlay;
		return underlay ? referenceLayerUnderlayBounds(underlay) : null;
	}

	setViewport = (newViewport: ViewportData): void => {
		this.#tabViewport.apply(newViewport);
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
		this.#commitIdleFloatingSelection();
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
		const layers = doc.layers_metadata().map((record, i) => {
			const id = record.id;
			const common = {
				id,
				name: record.name,
				visible: record.visible,
				opacity: record.opacity
			};
			if (record.kind === 'reference') {
				const sourceBlob = this.#referenceLayerBlobs.get(id);
				if (!sourceBlob) {
					throw new Error(`Missing source blob for Reference Layer ${id}`);
				}
				const placement = record.placement!;
				return {
					kind: 'reference',
					...common,
					sourceBlob,
					sourceRgba: doc.layer_source_pixels_at(i)!.slice(),
					naturalWidth: record.natural_width!,
					naturalHeight: record.natural_height!,
					placement: {
						x: placement.x,
						y: placement.y,
						scale: placement.scale
					}
				} satisfies ReferenceLayerSnapshot;
			}
			const pixels = this.#floatingSelection.pixelLayerSnapshotPixels(
				id,
				doc.layer_pixels_at(i)!
			);
			return {
				kind: 'pixel' as const,
				...common,
				pixels: pixels.slice()
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
