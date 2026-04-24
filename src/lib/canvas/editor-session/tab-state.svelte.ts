import type { PixelCanvas, CanvasCoords, ResizeAnchor } from '../canvas-model';
import type { ViewportData, ViewportSize } from '../viewport';
import { addRecentColor } from '../color';
import type { SharedState } from '../shared-state.svelte';
import { createSamplingSession, type SamplingSession } from '../sampling-session.svelte';
import { createToolRunner, type ToolRunner, type EditorEffects } from '../tool-runner.svelte';
import { exportAsPng } from '../export';
import type { PointerType } from '../canvas-interaction.svelte';
import type { TabSnapshot } from '../workspace-snapshot';
import type { CanvasBackend } from './canvas-backend';
import type { DirtyNotifier } from './dirty-notifier';

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
	/** When provided, the tab adopts this canvas; otherwise a fresh canvas is created from `canvasWidth`/`canvasHeight`. */
	readonly pixelCanvas?: PixelCanvas;
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

	pixelCanvas = $state<PixelCanvas>(null!);
	viewport = $state<ViewportData>(null!);
	viewportSize = $state<ViewportSize>(DEFAULT_VIEWPORT_SIZE);
	renderVersion = $state(0);
	resizeAnchor = $state<ResizeAnchor>('top-left');
	isExportUIOpen = $state(false);

	#backend: CanvasBackend;
	#notifier: DirtyNotifier;
	#toolRunner: ToolRunner;

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

		if (deps.pixelCanvas) {
			this.pixelCanvas = deps.pixelCanvas;
		} else {
			const cw = deps.canvasWidth ?? DEFAULT_CANVAS_DIMENSION;
			const ch = deps.canvasHeight ?? DEFAULT_CANVAS_DIMENSION;
			this.pixelCanvas = this.#backend.canvasFactory.create(cw, ch);
		}

		if (deps.viewport) {
			this.viewport = deps.viewport;
		} else {
			const vd = this.#backend.viewportOps.forCanvas(
				this.pixelCanvas.width,
				this.pixelCanvas.height
			);
			this.viewport = deps.gridColor ? { ...vd, gridColor: deps.gridColor } : vd;
		}

		const self = this;
		this.samplingSession = createSamplingSession(() => self.pixelCanvas);

		this.#toolRunner = createToolRunner({
			host: {
				get pixelCanvas() {
					return self.pixelCanvas;
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
				case 'canvasReplaced':
					this.pixelCanvas = effect.canvas;
					this.viewport = this.#backend.viewportOps.clampPan(
						this.viewport,
						effect.canvas.width,
						effect.canvas.height,
						this.viewportSize.width,
						this.viewportSize.height
					);
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

	setViewport = (newViewport: ViewportData): void => {
		this.viewport = this.#backend.viewportOps.clampPan(
			newViewport,
			this.pixelCanvas.width,
			this.pixelCanvas.height,
			this.viewportSize.width,
			this.viewportSize.height
		);
		this.#notifier.markDirty(this.documentId);
	};

	zoomIn = (): void => {
		const centerX = this.viewportSize.width / 2;
		const centerY = this.viewportSize.height / 2;
		const newZoom = this.#backend.viewportOps.nextZoomLevel(this.viewport.zoom);
		const zoomed = this.#backend.viewportOps.zoomAtPoint(this.viewport, centerX, centerY, newZoom);
		this.setViewport(zoomed);
	};

	zoomOut = (): void => {
		const centerX = this.viewportSize.width / 2;
		const centerY = this.viewportSize.height / 2;
		const newZoom = this.#backend.viewportOps.prevZoomLevel(this.viewport.zoom);
		const zoomed = this.#backend.viewportOps.zoomAtPoint(this.viewport, centerX, centerY, newZoom);
		this.setViewport(zoomed);
	};

	zoomReset = (): void => {
		const centerX = this.viewportSize.width / 2;
		const centerY = this.viewportSize.height / 2;
		const zoomed = this.#backend.viewportOps.zoomAtPoint(this.viewport, centerX, centerY, 1.0);
		this.setViewport(zoomed);
	};

	zoomFit = (maxZoom: number = Infinity): void => {
		this.viewport = this.#backend.viewportOps.fitToViewport(
			this.viewport,
			this.pixelCanvas.width,
			this.pixelCanvas.height,
			this.viewportSize.width,
			this.viewportSize.height,
			maxZoom
		);
		this.#notifier.markDirty(this.documentId);
	};

	toggleGrid = (): void => {
		this.viewport = { ...this.viewport, showGrid: !this.viewport.showGrid };
		this.#notifier.markDirty(this.documentId);
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
		this.viewport = this.#backend.viewportOps.clampPan(
			this.viewport,
			newWidth,
			newHeight,
			this.viewportSize.width,
			this.viewportSize.height
		);
		this.renderVersion++;
		this.#notifier.markDirty(this.documentId);
	};

	toggleExportUI = (): void => {
		this.isExportUIOpen = !this.isExportUIOpen;
	};

	exportPng = (): void => {
		try {
			exportAsPng(this.pixelCanvas);
		} catch (error) {
			console.error('PNG export failed:', error);
		}
	};

	toSnapshot = (): TabSnapshot => ({
		id: this.documentId,
		name: this.name,
		width: this.pixelCanvas.width,
		height: this.pixelCanvas.height,
		pixels: this.pixelCanvas.pixels(),
		viewport: { ...this.viewport }
	});
}
