import type { ViewportData, ViewportOps, ViewportSize } from '../viewport';
import { navigationBounds, type CanvasDimensions, type NavigationBounds } from '../navigation-bounds';
import type { DirtyNotifier } from './dirty-notifier';

export interface TabViewportDeps {
	readonly initial: ViewportData;
	readonly initialViewportSize: ViewportSize;
	readonly getCanvasDimensions: () => CanvasDimensions;
	/** Active-Reference footprint in canvas-pixel coordinates, or `null` when the active layer is not a visible Reference Layer. */
	readonly getReferenceFootprint: () => NavigationBounds | null;
	readonly viewportOps: ViewportOps;
	readonly notifier: DirtyNotifier;
	readonly documentId: string;
}

/**
 * Per-tab binding of viewport state to the current canvas, and the single
 * authority for Navigation Bounds clamping. Owns `ViewportData` + `ViewportSize`
 * and routes every viewport mutation through one clamp sink fed by the injected
 * canvas dimensions and active-Reference footprint, so the canvas can never be
 * panned or zoomed entirely out of reach. Reads canvas dimensions and footprint
 * through injected reactive getters, and emits `markDirty(documentId)` on every
 * persisted viewport change.
 *
 * The viewport adopted at construction is taken as-is (a restored snapshot is
 * not re-clamped); it self-corrects on the first `reclamp` — e.g. the initial
 * `setViewportSize` measurement. `setViewportSize` itself tracks DOM-measurement
 * layout state that `TabState.toSnapshot()` does not serialize, so it marks the
 * tab dirty only when the re-clamp it triggers actually relocates pan.
 */
export class TabViewport {
	#viewportOps: ViewportOps;
	#notifier: DirtyNotifier;
	#documentId: string;
	#getCanvasDimensions: () => CanvasDimensions;
	#getReferenceFootprint: () => NavigationBounds | null;

	viewport = $state<ViewportData>(null!);
	viewportSize = $state<ViewportSize>(null!);

	constructor(deps: TabViewportDeps) {
		this.viewport = deps.initial;
		this.viewportSize = deps.initialViewportSize;
		this.#getCanvasDimensions = deps.getCanvasDimensions;
		this.#getReferenceFootprint = deps.getReferenceFootprint;
		this.#viewportOps = deps.viewportOps;
		this.#notifier = deps.notifier;
		this.#documentId = deps.documentId;
	}

	apply(vd: ViewportData): void {
		this.#commit(this.#clampToNavigationBounds(vd));
	}

	setViewportSize(size: ViewportSize): void {
		this.viewportSize = size;
		this.reclamp();
	}

	zoomIn(): void {
		const newZoom = this.#viewportOps.nextZoomLevel(this.viewport.zoom);
		this.#zoomCenteredTo(newZoom);
	}

	zoomOut(): void {
		const newZoom = this.#viewportOps.prevZoomLevel(this.viewport.zoom);
		this.#zoomCenteredTo(newZoom);
	}

	zoomReset(): void {
		this.#zoomCenteredTo(1.0);
	}

	zoomFit(maxZoom: number = Infinity): void {
		const { width: cw, height: ch } = this.#getCanvasDimensions();
		this.apply(
			this.#viewportOps.fitToViewport(
				this.viewport,
				cw,
				ch,
				this.viewportSize.width,
				this.viewportSize.height,
				maxZoom
			)
		);
	}

	toggleGrid(): void {
		this.apply({ ...this.viewport, showGrid: !this.viewport.showGrid });
	}

	toggleOnionSkin(): void {
		this.apply({ ...this.viewport, showOnionSkin: !this.viewport.showOnionSkin });
	}

	/**
	 * Re-clamps the current viewport against the latest Navigation Bounds
	 * (canvas dimensions ∪ active-Reference footprint). Used after the document
	 * changes or the viewport is resized. Marks the tab dirty only when the
	 * clamp truly relocates pan, so an inert reclamp leaves persisted state
	 * unchanged.
	 */
	reclamp(): void {
		const clamped = this.#clampToNavigationBounds(this.viewport);
		if (clamped.panX === this.viewport.panX && clamped.panY === this.viewport.panY) return;
		this.#commit(clamped);
	}

	#clampToNavigationBounds(vd: ViewportData): ViewportData {
		const bounds = navigationBounds(this.#getCanvasDimensions(), this.#getReferenceFootprint());
		return this.#viewportOps.clampPanToDocumentBounds(
			vd,
			bounds.minX,
			bounds.minY,
			bounds.maxX,
			bounds.maxY,
			this.viewportSize.width,
			this.viewportSize.height
		);
	}

	#commit(vd: ViewportData): void {
		this.viewport = vd;
		this.#notifier.markDirty(this.#documentId);
	}

	#zoomCenteredTo(newZoom: number): void {
		const centerX = this.viewportSize.width / 2;
		const centerY = this.viewportSize.height / 2;
		this.apply(this.#viewportOps.zoomAtPoint(this.viewport, centerX, centerY, newZoom));
	}
}
