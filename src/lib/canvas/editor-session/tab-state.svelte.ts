import type { Document, PixelCanvas, CanvasCoords, ResizeAnchor } from '../canvas-model';
import { resizeDocumentWithAnchor, singleLayerDocument } from '../wasm-backend';
import type { ViewportData, ViewportSize } from '../viewport';
import { addRecentColor } from '../color';
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
import type { TabSnapshot } from '../workspace-snapshot';
import type { CanvasBackend } from './canvas-backend';
import type { DirtyNotifier } from './dirty-notifier';
import { TabViewport } from './tab-viewport.svelte';

function assertNever(x: never): never {
	throw new Error(`Unhandled effect type: ${(x as { type: string }).type}`);
}

function activeLayerPixels(doc: Document): Uint8Array {
	const id = doc.active_layer_id();
	for (let i = 0; i < doc.layer_count(); i++) {
		if (doc.layer_id_at(i) === id) {
			return doc.layer_pixels_at(i)!;
		}
	}
	throw new Error(`Active layer ${id} not found in document`);
}

export interface TabStateDeps {
	readonly backend: CanvasBackend;
	readonly shared: SharedState;
	readonly keyboard: { readonly getShiftHeld: () => boolean };
	readonly notifier: DirtyNotifier;
	readonly documentId: string;
	readonly name: string;
	/** When provided, the tab adopts this document; otherwise a fresh empty document is created from `canvasWidth`/`canvasHeight`. The Document is the single source of truth — pixelCanvas is derived from its active layer. */
	readonly document?: Document;
	/** When provided, the tab adopts this viewport; otherwise a fitted viewport is computed from the canvas dimensions. */
	readonly viewport?: ViewportData;
	readonly canvasWidth?: number;
	readonly canvasHeight?: number;
	readonly gridColor?: string;
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

	pixelCanvas = $state<PixelCanvas>(null!);
	document = $state<Document>(null!);
	renderVersion = $state(0);
	resizeAnchor = $state<ResizeAnchor>('top-left');
	isExportUIOpen = $state(false);

	#backend: CanvasBackend;
	#notifier: DirtyNotifier;
	#toolRunner: ToolRunner;
	#tabViewport: TabViewport;

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

		if (deps.document) {
			this.document = deps.document;
		} else {
			const cw = deps.canvasWidth ?? DEFAULT_CANVAS_DIMENSION;
			const ch = deps.canvasHeight ?? DEFAULT_CANVAS_DIMENSION;
			this.document = singleLayerDocument(cw, ch, new Uint8Array(cw * ch * 4));
		}
		this.pixelCanvas = this.#backend.canvasFactory.fromPixels(
			this.document.width,
			this.document.height,
			activeLayerPixels(this.document)
		);

		let initialViewport: ViewportData;
		if (deps.viewport) {
			initialViewport = deps.viewport;
		} else {
			const vd = this.#backend.viewportOps.forCanvas(
				this.pixelCanvas.width,
				this.pixelCanvas.height
			);
			initialViewport = deps.gridColor ? { ...vd, gridColor: deps.gridColor } : vd;
		}

		const self = this;
		this.#tabViewport = new TabViewport({
			initial: initialViewport,
			initialViewportSize: DEFAULT_VIEWPORT_SIZE,
			getCanvasDimensions: () => ({
				width: self.pixelCanvas.width,
				height: self.pixelCanvas.height
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
				get pixelCanvas() {
					return self.pixelCanvas;
				},
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
					this.pixelCanvas = this.#backend.canvasFactory.fromPixels(
						effect.document.width,
						effect.document.height,
						activeLayerPixels(effect.document)
					);
					this.#tabViewport.reclamp();
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
		this.pixelCanvas = this.#backend.canvasFactory.fromPixels(
			this.document.width,
			this.document.height,
			activeLayerPixels(this.document)
		);
		this.renderVersion++;
		this.#notifier.markDirty(this.documentId);
	};

	setViewport = (newViewport: ViewportData): void => {
		this.#tabViewport.apply(
			this.#backend.viewportOps.clampPan(
				newViewport,
				this.pixelCanvas.width,
				this.pixelCanvas.height,
				this.viewportSize.width,
				this.viewportSize.height
			)
		);
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
		if (newWidth === this.pixelCanvas.width && newHeight === this.pixelCanvas.height) return;
		this.#toolRunner.pushSnapshot();
		this.pixelCanvas = this.#backend.canvasFactory.resizeWithAnchor(
			this.pixelCanvas,
			newWidth,
			newHeight,
			this.resizeAnchor
		);
		resizeDocumentWithAnchor(this.document, newWidth, newHeight, this.resizeAnchor);
		this.#tabViewport.reclamp();
		this.renderVersion++;
	};

	toggleExportUI = (): void => {
		this.isExportUIOpen = !this.isExportUIOpen;
	};

	exportPng = (): void => {
		try {
			const exportCanvas = this.#backend.canvasFactory.fromPixels(
				this.document.width,
				this.document.height,
				this.document.composite()
			);
			exportAsPng(exportCanvas);
		} catch (error) {
			console.error('PNG export failed:', error);
		}
	};

	toSnapshot = (): TabSnapshot => ({
		id: this.documentId,
		name: this.name,
		width: this.document.width,
		height: this.document.height,
		pixels: this.document.composite(),
		viewport: { ...this.viewport }
	});
}
