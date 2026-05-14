import type { Document, PixelCanvas, CanvasCoords, ResizeAnchor } from '../canvas-model';
import { resizeDocumentWithAnchor, singleLayerDocument } from '../wasm-backend';
import { isBlankCanvas } from '../blank-detection';
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

export interface TabStateDeps {
	readonly backend: CanvasBackend;
	readonly shared: SharedState;
	readonly keyboard: { readonly getShiftHeld: () => boolean };
	readonly notifier: DirtyNotifier;
	readonly documentId: string;
	readonly name: string;
	/** When provided, the tab adopts this document; otherwise a fresh empty document is created from `canvasWidth`/`canvasHeight`. The Document is the single source of truth for pixel data. */
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
	 * source-over composite of every visible layer — the main canvas reads
	 * this so all layers are visible, not just the active one.
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
		this.renderVersion++;
		this.#notifier.markDirty(this.documentId);
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
		this.renderVersion++;
		this.#notifier.markDirty(this.documentId);
	};

	setActiveLayer = (id: string): void => {
		if (id === this.document.active_layer_id()) return;
		this.document.set_active_layer(id);
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
		if (currentStackIdx === targetStackIdx) return;
		this.#toolRunner.pushSnapshot();
		this.document.reorder_layer(id, targetStackIdx);
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
		this.renderVersion++;
		this.#notifier.markDirty(this.documentId);
	};

	#stackIndexOf(id: string): number {
		const doc = this.document;
		const count = doc.layer_count();
		for (let i = 0; i < count; i++) {
			if (doc.layer_id_at(i) === id) return i;
		}
		throw new Error(`Layer with id ${id} not found`);
	}

	setViewport = (newViewport: ViewportData): void => {
		this.#tabViewport.apply(
			this.#backend.viewportOps.clampPan(
				newViewport,
				this.document.width,
				this.document.height,
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
		if (newWidth === this.document.width && newHeight === this.document.height) return;
		this.#toolRunner.pushSnapshot();
		resizeDocumentWithAnchor(this.document, newWidth, newHeight, this.resizeAnchor);
		this.canvasWidth = newWidth;
		this.canvasHeight = newHeight;
		this.#tabViewport.reclamp();
		this.renderVersion++;
	};

	toggleExportUI = (): void => {
		this.isExportUIOpen = !this.isExportUIOpen;
	};

	/**
	 * Builds a fresh `PixelCanvas` from `document.composite()` — used by
	 * exporters that need `encode_png` / `encode_svg`. The buffer is a
	 * one-shot snapshot; callers must not retain it across mutations.
	 */
	exportableSnapshot = (): PixelCanvas => {
		return this.#backend.canvasFactory.fromPixels(
			this.document.width,
			this.document.height,
			this.document.composite()
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
		const layers = Array.from({ length: layerCount }, (_, i) => ({
			id: doc.layer_id_at(i)!,
			name: doc.layer_name_at(i)!,
			pixels: doc.layer_pixels_at(i)!.slice(),
			visible: doc.layer_visible_at(i)!,
			opacity: doc.layer_opacity_at(i)!
		}));
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
