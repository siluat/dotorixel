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
	canvasFactory,
	clearActiveLayerPixels,
	createDocumentHistory,
	fitReferencePlacementToCanvas,
	marqueeRegionFromDrag,
	resizeDocumentWithAnchor,
	singleLayerDocument,
	viewportOps
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
import { isPixelMutationTool } from '../tool-registry';
import { exportAsPng } from '../export';
import type { PointerType } from '../canvas-interaction.svelte';
import type { ReferenceLayerSnapshot, TabSnapshot } from '../workspace-snapshot';
import {
	DocumentLayerProjection,
	type DocumentLayerProjectionRead
} from '../document-layer-projection';
import {
	readDocumentFrameProjection,
	type DocumentFrameProjectionRead
} from '../document-frame-projection';
import {
	referenceLayerUnderlaySourceCoords,
	type ReferenceLayerUnderlay
} from '../reference-layer-underlay';
import type { DirtyNotifier } from './dirty-notifier';
import {
	DocumentChangeJournal,
	type DocumentChangeResult,
	type ReferenceLayerSource,
	type UndoableDocumentIntent
} from './document-change-journal.svelte';
import {
	type CommitFloatingSelectionIntent,
	FloatingSelectionLifecycle,
	type FloatingSelectionOffset
} from './floating-selection-lifecycle';
import { TabViewport } from './tab-viewport.svelte';
import {
	DEFAULT_ONION_SKIN_CONFIG,
	onionSkinGhosts,
	type OnionSkinGhostRead
} from './onion-skin';
import {
	PlaybackController,
	rafFrameScheduler,
	type FrameScheduler
} from './playback-controller.svelte';

export type { ReferenceLayerSource } from './document-change-journal.svelte';

function assertNever(x: never): never {
	throw new Error(`Unhandled effect type: ${(x as { type: string }).type}`);
}

function serializeMarquee(region: MarqueeRegion | null | undefined): TabSnapshot['marquee'] {
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
	/** Animation-frame clock for playback; defaults to the browser's rAF. Injected by tests. */
	readonly frameScheduler?: FrameScheduler;
}

const DEFAULT_CANVAS_DIMENSION = 16;
const DEFAULT_VIEWPORT_SIZE: ViewportSize = { width: 512, height: 512 };

// Shared empty projection so the off/playback/no-neighbor branches return a
// referentially stable value instead of a fresh array per read.
const NO_GHOSTS: readonly OnionSkinGhostRead[] = [];

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
	 *
	 * While playing, `pixels()` returns the Playhead frame's committed composite
	 * (`composite_at`) instead of the edit composite — playback previews committed
	 * art, with no Floating Selection overlay.
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
			pixels: () => {
				const playheadFrameId = self.#playback.playheadFrameId;
				return playheadFrameId !== null
					? self.document.composite_at(playheadFrameId)
					: self.#floatingSelection.previewPixels();
			}
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
	 * Projects the current Document Frame axis into the shell-facing read model —
	 * frames in axis order, the active frame, and per-Cel occupancy for the
	 * timeline grid. Tied to `renderVersion` so consumers refresh after drawing
	 * (a Cel's occupancy can flip), frame navigation, frame stack changes, undo,
	 * and redo.
	 */
	get frameProjection(): DocumentFrameProjectionRead {
		const renderVersion = this.renderVersion;
		const cached = this.#frameProjectionCache;
		if (cached?.document === this.document && cached.renderVersion === renderVersion) {
			return cached.read;
		}
		const read = readDocumentFrameProjection(this.document);
		this.#frameProjectionCache = {
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
	 * Projects the Onion Skin ghosts for the current Active Frame — each
	 * neighbor's descriptor plus its committed `composite_at` buffer, in axis
	 * order. Empty while the onion-skin flag is off, while Playback runs, or on
	 * a side with no neighbor. Tied to `renderVersion` like the frame
	 * projection, so ghosts refresh after drawing, frame navigation, undo, and
	 * redo. Computing it never mutates the document, never moves the Active
	 * Frame, and never pushes History.
	 */
	get onionSkinProjection(): readonly OnionSkinGhostRead[] {
		if (!this.viewport.showOnionSkin) return NO_GHOSTS;
		if (this.#playback.playheadFrameId !== null) return NO_GHOSTS;
		const renderVersion = this.renderVersion;
		const cached = this.#onionSkinProjectionCache;
		if (cached?.document === this.document && cached.renderVersion === renderVersion) {
			return cached.read;
		}
		const frames = this.frameProjection;
		const read = onionSkinGhosts(
			frames.frames.map((frame) => frame.id),
			frames.activeFrameId,
			DEFAULT_ONION_SKIN_CONFIG
		).map((ghost) => ({ ...ghost, pixels: this.document.composite_at(ghost.frameId) }));
		this.#onionSkinProjectionCache = {
			document: this.document,
			renderVersion,
			read
		};
		return read;
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
	#frameProjectionCache?: {
		readonly document: Document;
		readonly renderVersion: number;
		readonly read: DocumentFrameProjectionRead;
	};
	#onionSkinProjectionCache?: {
		readonly document: Document;
		readonly renderVersion: number;
		readonly read: readonly OnionSkinGhostRead[];
	};
	#floatingSelection = new FloatingSelectionLifecycle({
		getDocument: () => this.document,
		applyCommit: (intent) => this.#commitFloatingSelectionIntent(intent),
		getIsDrawing: () => this.isDrawing
	});
	#playback: PlaybackController;

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
			const vd = viewportOps.forCanvas(this.document.width, this.document.height);
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
			viewportOps,
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
			createDocumentHistory,
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
		this.#playback = new PlaybackController({
			getFrames: () =>
				this.document.frames_metadata().map((frame) => ({
					id: frame.id,
					durationMs: frame.duration_ms
				})),
			commitFloatingSelection: () => this.#floatingSelection.commitIfPending(),
			requestRender: () => {
				this.renderVersion++;
			},
			frameScheduler: deps.frameScheduler ?? rafFrameScheduler
		});
	}

	#applyEffects(effects: EditorEffects): void {
		let persistableChanged = false;
		for (const effect of effects) {
			switch (effect.type) {
				case 'beginEdit':
					// A stroke's capture begins the pending Edit Baseline; it
					// commits at drawEnd/drawCancel only if the stroke changed
					// the document (issue 243).
					this.#documentChangeJournal.beginEdit();
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
					this.#floatingSelection.commit();
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

	/**
	 * The single boundary every undoable document mutation routes through: it
	 * first commits any pending Floating Selection (the commit-before-mutation
	 * policy lives behind the lifecycle's `commitIfPending`), then applies the
	 * intent through the journal. Returns the journal's `DocumentChangeResult`,
	 * which carries the new layer id for layer-creating intents.
	 */
	#mutate(intent: UndoableDocumentIntent): DocumentChangeResult {
		// A document edit exits the playback preview: a structural change (e.g.
		// deleting the frame under the playhead) must not run against a moving
		// playhead. Stopping first returns the display to the Active Frame.
		this.#playback.stop();
		this.#floatingSelection.commitIfPending();
		return this.#documentChangeJournal.commit({ kind: 'undoable-document', intent });
	}

	#visibleCanvasRect(): DocumentRect | null {
		const topLeft = viewportOps.screenToCanvasPoint(this.viewport, 0, 0);
		const bottomRight = viewportOps.screenToCanvasPoint(
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
		// Editability is enforced here, at the document-state entry: a pixel-mutation
		// stroke on a non-editable active layer (a Reference Layer) never dispatches,
		// so it opens no session and does not disturb Playback. Non-mutation tools
		// (the eyedropper) still proceed — Reference Sampling stays available.
		if (isPixelMutationTool(this.shared.activeTool) && !this.layerProjection.isActiveLayerEditable) {
			return;
		}
		// A tool stroke edits the Active Frame's Cel — exit the playback preview
		// first so the user draws on (and sees) the frame being edited, not the
		// moving Playhead. `#mutate` covers undoable document mutations; this covers
		// the incremental tool strokes that apply through `#applyEffects` instead.
		this.#playback.stop();
		this.#applyEffects(
			this.#floatingSelection.withDrawStartPolicy(
				this.shared.activeTool === 'selection',
				() => this.#toolRunner.drawStart(button, pointerType)
			)
		);
	};

	draw = (current: CanvasPoint, previous: CanvasPoint | null): void => {
		if (this.layerProjection.isActiveLayerEditable) {
			this.#floatingSelection.commitIfSelectionDragStartsOutside(current, previous);
		}
		this.#applyEffects(this.#toolRunner.draw(current, previous));
	};

	drawEnd = (): void => {
		// End the selection-drag stroke before applying effects so the final
		// Marquee commit's snapshot reads the live Marquee, not the stale baseline.
		this.#floatingSelection.endSelectionDrag();
		this.#applyEffects(this.#toolRunner.drawEnd());
		this.#documentChangeJournal.endEdit();
	};

	drawCancel = (): void => {
		this.#applyEffects(this.#toolRunner.drawCancel());
		this.#floatingSelection.endSelectionDrag();
		this.#documentChangeJournal.endEdit();
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
		this.#playback.stop();
		if (this.isDrawing) return;
		if (this.#floatingSelection.isActive) {
			this.#recordFloatingPreviewChanged(this.#floatingSelection.cancel());
			return;
		}
		this.#documentChangeJournal.undo();
	};

	redo = (): void => {
		this.#playback.stop();
		if (this.isDrawing) return;
		if (this.#floatingSelection.isActive) return;
		this.#documentChangeJournal.redo();
	};

	clear = (): void => {
		if (this.isDrawing) return;
		this.#mutate({ type: 'clear-active-layer' });
	};

	flipMarqueeHorizontal = (): void => {
		if (this.isDrawing) return;
		this.#mutate({ type: 'flip-marquee-horizontal' });
	};

	flipMarqueeVertical = (): void => {
		if (this.isDrawing) return;
		this.#mutate({ type: 'flip-marquee-vertical' });
	};

	flipCanvasHorizontal = (): void => {
		if (this.isDrawing) return;
		this.#mutate({ type: 'flip-canvas-horizontal' });
	};

	flipCanvasVertical = (): void => {
		if (this.isDrawing) return;
		this.#mutate({ type: 'flip-canvas-vertical' });
	};

	rotateCanvasCw = (): void => {
		if (this.isDrawing) return;
		this.#mutate({ type: 'rotate-canvas-cw' });
	};

	rotateCanvasCcw = (): void => {
		if (this.isDrawing) return;
		this.#mutate({ type: 'rotate-canvas-ccw' });
	};

	rotateMarqueeCw = (): void => {
		if (this.isDrawing) return;
		this.#mutate({ type: 'rotate-marquee-cw' });
	};

	rotateMarqueeCcw = (): void => {
		if (this.isDrawing) return;
		this.#mutate({ type: 'rotate-marquee-ccw' });
	};

	clearMarquee = (): void => {
		this.#mutate({ type: 'set-marquee', region: null });
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
		this.#mutate({ type: 'clear-marquee-pixels' });
	};

	nudgeMarquee = (dx: number, dy: number): void => {
		if (this.isDrawing) return;
		if (!this.layerProjection.isActiveLayerEditable) return;
		this.#recordFloatingPreviewChanged(this.#floatingSelection.nudgeMarquee({ dx, dy }));
	};

	commitFloatingSelection = (): void => {
		this.#floatingSelection.commitIfPending();
	};

	duplicateFloatingSelection = (): void => {
		if (this.isDrawing) return;
		this.#recordFloatingPreviewChanged(this.#floatingSelection.duplicate());
	};

	pasteSelectionClipboard = (clipboard: SelectionClipboardData): void => {
		if (this.isDrawing) return;
		if (!this.layerProjection.isActiveLayerEditable) return;
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
		if (!this.layerProjection.isActiveLayerEditable) return null;

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

	addLayer = (name: string): void => {
		this.#mutate({ type: 'add-pixel-layer', name });
	};

	/**
	 * Sets or replaces the document's singleton Reference Layer from a decoded
	 * source image. The previous Reference document state remains undoable, so
	 * old source blobs stay cached even after a successful replacement.
	 */
	setReferenceLayer = (source: ReferenceLayerSource): string => {
		const result = this.#mutate({ type: 'set-reference-layer', source });
		if (!result.changed || !result.layerId) {
			throw new Error('Reference Layer change did not produce a layer id');
		}
		return result.layerId;
	};

	/**
	 * Removes the layer with `id`. A no-op while a stroke is drawing (a live
	 * stroke's target must not vanish mid-stroke) and when only one layer remains
	 * (last-layer guard parallels the UI's disabled affordance and keeps history
	 * clean — no History entry in that branch). When the removed layer was
	 * active, the active pointer moves to an adjacent layer (delegated to the
	 * core). Records an undo entry, bumps `renderVersion`, and marks the tab
	 * dirty. Throws if `id` does not refer to an existing layer.
	 */
	removeLayer = (id: string): void => {
		// Mid-stroke seal: never move or destroy the stroke's target while drawing.
		if (this.isDrawing) return;
		this.#mutate({ type: 'remove-layer', id });
	};

	setActiveLayer = (id: string): void => {
		// Mid-stroke seal: never move or destroy the stroke's target while drawing.
		if (this.isDrawing) return;
		// A persisted-UI mutation rather than undoable, so it routes the
		// commit-before-mutation policy through the lifecycle directly instead of
		// the undoable `#mutate` boundary.
		this.#floatingSelection.commitIfPending();
		this.#documentChangeJournal.commit({
			kind: 'persisted-document-ui',
			intent: { type: 'set-active-layer', id }
		});
	};

	/**
	 * Moves the layer with `id` to `newVisualIndex` in **panel order** (top of
	 * panel = visual 0). Translates visual→stack via
	 * `stack_idx = (layer_count - 1) - visual_idx` and delegates to the core.
	 * No-op when the layer is already at that visual position (no History entry, no
	 * renderVersion bump, no markDirty — keeps history clean and parallels the
	 * `removeLayer` last-layer rule). Records an undo entry on the
	 * real-move branch and bumps `renderVersion`. Throws if `id` does not refer
	 * to an existing layer.
	 */
	reorderLayer = (id: string, newVisualIndex: number): void => {
		this.#mutate({ type: 'reorder-layer', id, newVisualIndex });
	};

	/**
	 * Sets the visibility flag of the layer with `id`. No-op when the layer's
	 * `visible` is already `visible` (no History entry, no renderVersion bump, no
	 * markDirty — keeps history clean and parallels the `setActiveLayer`
	 * idempotency pattern). On a real change, records an undo entry, bumps
	 * `renderVersion`, and marks the tab dirty. Throws if `id` does not refer
	 * to an existing layer.
	 */
	setLayerVisibility = (id: string, visible: boolean): void => {
		this.#mutate({ type: 'set-layer-visibility', id, visible });
	};

	/**
	 * Moves a Reference Layer's source image in canvas pixel space. `placement.x`
	 * and `placement.y` are document-pixel coordinates; `placement.scale` must
	 * be finite and positive. No-ops when unchanged. On a real change, records an
	 * undo entry, updates the document, bumps `renderVersion`, and marks this
	 * tab dirty. Throws when `id` does not exist or is not a Reference Layer.
	 */
	setReferencePlacement = (id: string, placement: ReferencePlacement): void => {
		this.#mutate({ type: 'set-reference-placement', id, placement });
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
	 * Inserts a transparent frame after the active frame and makes it active.
	 * Routes through `#mutate`, so any in-flight Floating Selection commits onto
	 * its origin frame first. Records an undo entry and marks the tab dirty.
	 */
	addFrame = (): void => {
		this.#mutate({ type: 'add-frame' });
	};

	/**
	 * Inserts a deep copy of the active frame after it and makes the copy active.
	 * Like `addFrame`, commits a pending Floating Selection first and is undoable.
	 */
	duplicateFrame = (): void => {
		this.#mutate({ type: 'duplicate-frame' });
	};

	/**
	 * Removes the frame with `id`. A no-op while a stroke is drawing (a live
	 * stroke's target must not vanish mid-stroke) and when only one frame remains
	 * (last-frame rule keeps history clean — no History entry). When the removed frame
	 * was active, the active pointer moves to an adjacent frame (delegated to the
	 * core). Records an undo entry on the real-removal branch.
	 */
	removeFrame = (id: string): void => {
		// Mid-stroke seal: never move or destroy the stroke's target while drawing.
		if (this.isDrawing) return;
		this.#mutate({ type: 'remove-frame', id });
	};

	/**
	 * Moves the frame with `id` to `newIndex` — a 0-based axis position where
	 * ordinal 1 is index 0. No-op when the frame is already there (no History entry).
	 * Records an undo entry on a real move.
	 */
	reorderFrame = (id: string, newIndex: number): void => {
		this.#mutate({ type: 'reorder-frame', id, newIndex });
	};

	/**
	 * Sets the active frame by id. A no-op while a stroke is drawing (the active
	 * frame must not switch mid-stroke). Like `setActiveLayer`, this is a
	 * persisted-UI mutation (not undoable), so it routes the commit-before-mutation
	 * policy through the lifecycle directly — committing a pending Floating
	 * Selection onto the frame it was lifted from before the active frame changes.
	 */
	setActiveFrame = (id: string): void => {
		// Mid-stroke seal: never move or destroy the stroke's target while drawing.
		if (this.isDrawing) return;
		this.#floatingSelection.commitIfPending();
		this.#documentChangeJournal.commit({
			kind: 'persisted-document-ui',
			intent: { type: 'set-active-frame', id }
		});
	};

	/**
	 * Sets the display duration (in milliseconds) of the frame with `id`. Routes
	 * through `#mutate` (committing any in-flight Floating Selection first) and is
	 * undoable — one committed adjustment is one undo step. No-op when the frame
	 * already holds that duration. The WASM boundary clamps the value to
	 * `[1, 60_000]` ms.
	 */
	setFrameDuration = (id: string, durationMs: number): void => {
		this.#mutate({ type: 'set-frame-duration', id, durationMs });
	};

	/** True while in-editor playback is running its transient Playhead. */
	get isPlaying(): boolean {
		return this.#playback.isPlaying;
	}

	/** True when playback wraps to the first frame at the end instead of stopping. */
	get isLooping(): boolean {
		return this.#playback.isLooping;
	}

	/**
	 * The frame the transient Playhead currently shows, or `null` while stopped.
	 * Drives the transport readout (playhead ordinal) and the ruler's ▼ marker; it
	 * is never the Active Frame (the edit pointer, which playback leaves untouched).
	 */
	get playheadFrameId(): string | null {
		return this.#playback.playheadFrameId;
	}

	/**
	 * Starts in-editor playback from the first frame. Commits any in-flight
	 * Floating Selection first so the preview shows the committed Document, then
	 * drives the transient Playhead through the sequence honoring each frame's
	 * duration. Playback never mutates the Document, pushes a history entry, or
	 * marks the tab dirty, and leaves the Active Frame untouched.
	 */
	startPlayback = (): void => {
		this.#playback.start();
	};

	/**
	 * Stops playback and discards the Playhead, returning the display to the
	 * Active Frame (which never moved). No-op when already stopped. Also invoked
	 * on tab switches, tab close, and structural document changes.
	 */
	stopPlayback = (): void => {
		this.#playback.stop();
	};

	/** Toggles whether playback loops at the end of the sequence. */
	toggleLoop = (): void => {
		this.#playback.toggleLoop();
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
		return underlay ? underlay.projectedBounds : null;
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

	toggleOnionSkin = (): void => {
		this.#tabViewport.toggleOnionSkin();
	};

	resize = (newWidth: number, newHeight: number): void => {
		this.#mutate({
			type: 'resize-document',
			width: newWidth,
			height: newHeight,
			anchor: this.resizeAnchor
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
		return canvasFactory.fromPixels(
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
		const activeFrameId = doc.active_frame_id();
		const frameMetadata = doc.frames_metadata();
		const frameIds = frameMetadata.map((frame) => frame.id);
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
						scale: placement.scale,
						rotation: placement.rotation
					}
				} satisfies ReferenceLayerSnapshot;
			}
			// One Cel per frame. The floating selection is lifted from the active
			// layer's active-frame Cel, so bake it only there; every other Cel
			// persists its stored pixels untouched.
			const cels = frameIds.map((frameId) => {
				const stored = doc.cel_pixels_at(i, frameId)!;
				const pixels =
					frameId === activeFrameId
						? this.#floatingSelection.pixelLayerSnapshotPixels(id, stored)
						: stored;
				return { frameId, pixels: pixels.slice() };
			});
			return {
				kind: 'pixel' as const,
				...common,
				cels
			};
		});
		const marquee = serializeMarquee(
			this.#floatingSelection.marqueeForSnapshot(doc.marquee() ?? null)
		);
		return {
			id: this.documentId,
			name: this.name,
			width: doc.width,
			height: doc.height,
			marquee,
			layers,
			frames: frameMetadata.map((frame) => ({ id: frame.id, durationMs: frame.duration_ms })),
			activeFrameId,
			activeLayerId: doc.active_layer_id(),
			nextLayerNumber: doc.next_layer_number(),
			timelinePanelCollapsed: doc.is_timeline_panel_collapsed(),
			viewport: { ...this.viewport }
		};
	};
}
